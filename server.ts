import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

const db = new Database("memento.db");

// Initialize Gemini AI client (API key is read from .env)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    birth_date TEXT,
    expected_lifespan INTEGER,
    quote TEXT DEFAULT 'Memento Mori'
  );
`);

// Migration for existing users
try {
  db.exec("ALTER TABLE users ADD COLUMN quote TEXT DEFAULT 'Memento Mori'");
} catch (e) {
  // Column already exists, ignore
}

const hashPassword = (password: string) => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const id = crypto.randomUUID();
    const password_hash = hashPassword(password);

    try {
      const stmt = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)");
      stmt.run(id, username, password_hash);
      res.json({ id, username });
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Username already exists" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const password_hash = hashPassword(password);
    const stmt = db.prepare("SELECT * FROM users WHERE username = ? AND password_hash = ?");
    const user = stmt.get(username, password_hash) as any;

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      birthDate: user.birth_date,
      expectedLifespan: user.expected_lifespan,
      quote: user.quote,
    });
  });

  app.post("/api/user/:id", (req, res) => {
    const { id } = req.params;
    const { name, birthDate, expectedLifespan, quote } = req.body;

    try {
      const stmt = db.prepare(
        "UPDATE users SET name = ?, birth_date = ?, expected_lifespan = ?, quote = ? WHERE id = ?"
      );
      const info = stmt.run(name, birthDate, expectedLifespan, quote, id);
      
      if (info.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (err) {
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
