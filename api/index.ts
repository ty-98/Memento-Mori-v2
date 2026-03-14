import "dotenv/config";
import express from "express";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { kv } from "@vercel/kv";
import Database from "better-sqlite3";

// Determine if we should use KV (production) or SQLite (local dev)
const USE_KV = !!process.env.KV_REST_API_URL;
let db: any = null;

if (!USE_KV) {
  db = new Database("memento.db");
  // Initialize DB schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      birth_date TEXT,
      expected_lifespan INTEGER,
      quote TEXT DEFAULT 'Memento Mori',
      notes TEXT,
      bg_color TEXT,
      text_color TEXT,
      decade_goals TEXT
    );
  `);

  const migrations = [
    "ALTER TABLE users ADD COLUMN quote TEXT DEFAULT 'Memento Mori'",
    "ALTER TABLE users ADD COLUMN notes TEXT",
    "ALTER TABLE users ADD COLUMN bg_color TEXT",
    "ALTER TABLE users ADD COLUMN text_color TEXT",
    "ALTER TABLE users ADD COLUMN decade_goals TEXT"
  ];
  for (const query of migrations) {
    try { db.exec(query); } catch (e) {}
  }
}

// Initialize Gemini AI client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const hashPassword = (password: string) => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

const app = express();
app.use(express.json());

// API Routes
app.post("/api/auth/register", async (req, res) => {
  const { username, password, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const id = crypto.randomUUID();
  const password_hash = hashPassword(password);

  const newUserData = {
    id,
    username,
    name: name || "Anonymous",
    birthDate: birthDate || "1990-01-01",
    expectedLifespan: expectedLifespan || 80,
    quote: quote || "Memento Mori",
    notes: notes || "",
    bgColor: bgColor || "#050505",
    textColor: textColor || "#fafafa",
    decadeGoals: decadeGoals || {}
  };

  try {
    if (USE_KV) {
      // Check if user exists
      const existingUser = await kv.get(`user:creds:${username}`);
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }
      await kv.set(`user:creds:${username}`, { password_hash, id });
      await kv.set(`user:profile:${id}`, newUserData);
    } else {
      const stmt = db.prepare(
        "INSERT INTO users (id, username, password_hash, name, birth_date, expected_lifespan, quote, notes, bg_color, text_color, decade_goals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(
        id, username, password_hash, newUserData.name, newUserData.birthDate, newUserData.expectedLifespan, newUserData.quote, newUserData.notes, newUserData.bgColor, newUserData.textColor, JSON.stringify(newUserData.decadeGoals)
      );
    }
    res.json(newUserData);
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const password_hash = hashPassword(password);

  try {
    if (USE_KV) {
      const creds: any = await kv.get(`user:creds:${username}`);
      if (!creds || creds.password_hash !== password_hash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const profile = await kv.get(`user:profile:${creds.id}`);
      return res.json(profile);
    } else {
      const stmt = db.prepare("SELECT * FROM users WHERE username = ? AND password_hash = ?");
      const user = stmt.get(username, password_hash) as any;
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      return res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        birthDate: user.birth_date,
        expectedLifespan: user.expected_lifespan,
        quote: user.quote,
        notes: user.notes,
        bgColor: user.bg_color,
        textColor: user.text_color,
        decadeGoals: user.decade_goals ? JSON.parse(user.decade_goals) : {},
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  const { name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals } = req.body;

  try {
    if (USE_KV) {
      const existingProfile: any = await kv.get(`user:profile:${id}`);
      if (!existingProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedData = { ...existingProfile, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals };
      await kv.set(`user:profile:${id}`, updatedData);
      return res.json({ success: true });
    } else {
      const stmt = db.prepare(
        "UPDATE users SET name = ?, birth_date = ?, expected_lifespan = ?, quote = ?, notes = ?, bg_color = ?, text_color = ?, decade_goals = ? WHERE id = ?"
      );
      const info = stmt.run(name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals ? JSON.stringify(decadeGoals) : null, id);
      if (info.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Gemini API proxy endpoint
app.post("/api/gemini", async (req, res) => {
  if (!genai) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured in .env" });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const text = response.text ?? "";
    res.json({ text });
  } catch (err: any) {
    console.error("Gemini API error:", err.message);
    res.status(500).json({ error: err.message || "Gemini API request failed" });
  }
});

export default app;
