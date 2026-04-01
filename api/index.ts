import "dotenv/config";
import express from "express";
import crypto from "crypto";
import Groq from "groq-sdk";
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
      decade_goals TEXT,
      avatar TEXT
    );
  `);

  const migrations = [
    "ALTER TABLE users ADD COLUMN quote TEXT DEFAULT 'Memento Mori'",
    "ALTER TABLE users ADD COLUMN notes TEXT",
    "ALTER TABLE users ADD COLUMN bg_color TEXT",
    "ALTER TABLE users ADD COLUMN text_color TEXT",
    "ALTER TABLE users ADD COLUMN decade_goals TEXT",
    "ALTER TABLE users ADD COLUMN avatar TEXT",
    "ALTER TABLE users ADD COLUMN bucket_list TEXT"
  ];
  for (const query of migrations) {
    try { db.exec(query); } catch (e) {}
  }
}

// Initialize Gemini AI client
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const hashPassword = (password: string) => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

const app = express();
app.use(express.json());

// API Routes
app.post("/api/auth/register", async (req, res) => {
  const { username, password, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList } = req.body;
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
    decadeGoals: decadeGoals || {},
    avatar: avatar || null,
    bucketList: bucketList || []
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
        "INSERT INTO users (id, username, password_hash, name, birth_date, expected_lifespan, quote, notes, bg_color, text_color, decade_goals, avatar, bucket_list) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(
        id, username, password_hash, newUserData.name, newUserData.birthDate, newUserData.expectedLifespan, newUserData.quote, newUserData.notes, newUserData.bgColor, newUserData.textColor, JSON.stringify(newUserData.decadeGoals), newUserData.avatar, JSON.stringify(newUserData.bucketList)
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
        avatar: user.avatar,
        bucketList: user.bucket_list ? JSON.parse(user.bucket_list) : []
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  const { name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList } = req.body;

  try {
    if (USE_KV) {
      const existingProfile: any = await kv.get(`user:profile:${id}`);
      if (!existingProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedData = { ...existingProfile, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList };
      await kv.set(`user:profile:${id}`, updatedData);
      return res.json({ success: true });
    } else {
      const stmt = db.prepare(
        "UPDATE users SET name = ?, birth_date = ?, expected_lifespan = ?, quote = ?, notes = ?, bg_color = ?, text_color = ?, decade_goals = ?, avatar = ?, bucket_list = ? WHERE id = ?"
      );
      const info = stmt.run(name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals ? JSON.stringify(decadeGoals) : null, avatar || null, bucketList ? JSON.stringify(bucketList) : null, id);
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

// Credentials update endpoint
app.put("/api/auth/:id/credentials", async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newUsername, newPassword } = req.body;

  if (!currentPassword || (!newUsername && !newPassword)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const current_password_hash = hashPassword(currentPassword);
  
  try {
    if (USE_KV) {
      const existingProfile: any = await kv.get(`user:profile:${id}`);
      if (!existingProfile) return res.status(404).json({ error: "User not found" });

      const oldUsername = existingProfile.username;
      const creds: any = await kv.get(`user:creds:${oldUsername}`);
      
      if (!creds || creds.password_hash !== current_password_hash) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      const updatedCreds = { ...creds };
      let newName = oldUsername;

      if (newPassword) {
        updatedCreds.password_hash = hashPassword(newPassword);
      }

      if (newUsername && newUsername !== oldUsername) {
        const usernameExists = await kv.get(`user:creds:${newUsername}`);
        if (usernameExists) return res.status(409).json({ error: "Username already exists" });
        newName = newUsername;
      }

      if (newUsername && newUsername !== oldUsername) {
        await kv.del(`user:creds:${oldUsername}`);
        await kv.set(`user:creds:${newName}`, updatedCreds);
        const updatedProfile = { ...existingProfile, username: newName };
        await kv.set(`user:profile:${id}`, updatedProfile);
      } else if (newPassword) {
        await kv.set(`user:creds:${newName}`, updatedCreds);
      }

      return res.json({ success: true, username: newName });
    } else {
      const user = db.prepare("SELECT * FROM users WHERE id = ? AND password_hash = ?").get(id, current_password_hash) as any;
      if (!user) return res.status(401).json({ error: "Invalid current password" });

      let newName = user.username;
      let newHash = current_password_hash;

      if (newPassword) {
        newHash = hashPassword(newPassword);
      }
      
      if (newUsername && newUsername !== user.username) {
        newName = newUsername;
      }

      const stmt = db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?");
      stmt.run(newName, newHash, id);
      return res.json({ success: true, username: newName });
    }
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user account endpoint
app.delete("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    if (USE_KV) {
      const profile: any = await kv.get(`user:profile:${id}`);
      if (!profile) return res.status(404).json({ error: "User not found" });
      
      const username = profile.username;
      await kv.del(`user:creds:${username}`);
      await kv.del(`user:profile:${id}`);
      return res.json({ success: true });
    } else {
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      if (info.changes === 0) return res.status(404).json({ error: "User not found" });
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Groq API proxy endpoint
app.post("/api/gemini", async (req, res) => {
  if (!groq) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured in .env" });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.choices[0]?.message?.content ?? "";
    res.json({ text });
  } catch (err: any) {
    console.error("Groq API error:", err.message);
    res.status(500).json({ error: err.message || "Groq API request failed" });
  }
});

export default app;
