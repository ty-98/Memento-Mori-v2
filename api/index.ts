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
    "ALTER TABLE users ADD COLUMN bucket_list TEXT",
    "ALTER TABLE users ADD COLUMN gender TEXT",
    "ALTER TABLE users ADD COLUMN share_token TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN memos TEXT DEFAULT '[]'",
    "ALTER TABLE users ADD COLUMN favorites TEXT DEFAULT '[]'",
    "ALTER TABLE users ADD COLUMN purpose TEXT",
    "ALTER TABLE users ADD COLUMN capital_scores TEXT"
  ];
  for (const query of migrations) {
    try { db.exec(query); } catch (e) {}
  }
}

// Initialize Gemini AI client
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// scrypt with random salt. Format: "<hex-salt>:<hex-hash>"
const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

// Supports both legacy SHA-256 (no colon) and current scrypt format
const verifyPassword = (password: string, stored: string): boolean => {
  if (!stored.includes(':')) {
    return crypto.createHash("sha256").update(password).digest("hex") === stored;
  }
  const colonIdx = stored.indexOf(':');
  const salt = stored.slice(0, colonIdx);
  const storedHash = stored.slice(colonIdx + 1);
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
};

// In-memory rate limiter: 10 attempts per 15 min per key
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const checkRateLimit = (key: string): boolean => {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || record.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (record.count >= 10) return true;
  record.count++;
  return false;
};

const isValidUsername = (u: string): boolean => /^[a-zA-Z0-9_-]{3,50}$/.test(u);

// Separate rate limiter for AI endpoint: 30 req / hour per IP
const groqAttempts = new Map<string, { count: number; resetAt: number }>();
const checkGroqRateLimit = (key: string): boolean => {
  const now = Date.now();
  const record = groqAttempts.get(key);
  if (!record || record.resetAt < now) {
    groqAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  if (record.count >= 30) return true;
  record.count++;
  return false;
};

// Rate limiter for share token API: 60 req / hour per token
const shareAttempts = new Map<string, { count: number; resetAt: number }>();
const checkShareRateLimit = (key: string): boolean => {
  const now = Date.now();
  const record = shareAttempts.get(key);
  if (!record || record.resetAt < now) {
    shareAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  if (record.count >= 60) return true;
  record.count++;
  return false;
};

const getUserByShareToken = (token: string) => {
  return db.prepare("SELECT * FROM users WHERE share_token = ?").get(token) as any;
};

const buildPublicProfile = (user: any) => {
  const birth = new Date(user.birth_date);
  const expectedEnd = new Date(birth.getTime() + user.expected_lifespan * 365.25 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const totalMs = expectedEnd.getTime() - birth.getTime();
  const elapsedMs = now.getTime() - birth.getTime();
  const remainingMs = expectedEnd.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
  return {
    name: user.name,
    birthDate: user.birth_date,
    expectedLifespan: user.expected_lifespan,
    gender: user.gender || null,
    quote: user.quote,
    notes: user.notes || "",
    decadeGoals: user.decade_goals ? JSON.parse(user.decade_goals) : {},
    bucketList: user.bucket_list ? JSON.parse(user.bucket_list) : [],
    favorites: user.favorites ? JSON.parse(user.favorites) : [],
    memos: (user.memos ? JSON.parse(user.memos) : []).slice(-10),
    computed: {
      elapsedPercent: parseFloat(Math.min(100, (elapsedMs / totalMs) * 100).toFixed(1)),
      remainingPercent: parseFloat(Math.max(0, (remainingMs / totalMs) * 100).toFixed(1)),
      remainingYears: parseFloat(Math.max(0, remainingMs / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)),
      remainingDays,
      expectedEndDate: expectedEnd.toISOString().split('T')[0],
    },
  };
};

const app = express();
app.use(express.json());

// API Routes
app.post("/api/auth/register", async (req, res) => {
  const { username, password, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList, gender } = req.body;
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  if (!trimmedUsername || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (!isValidUsername(trimmedUsername)) {
    return res.status(400).json({ error: "ユーザーIDは3〜50文字の英数字・アンダースコア・ハイフンのみ使用できます" });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: "パスワードは8文字以上にしてください" });
  }
  if (avatar && typeof avatar === 'string' && avatar.length > 400000) {
    return res.status(400).json({ error: "アバター画像が大きすぎます" });
  }

  const id = crypto.randomUUID();
  const password_hash = hashPassword(password);

  const newUserData = {
    id,
    username: trimmedUsername,
    name: name || "Anonymous",
    birthDate: birthDate || "1990-01-01",
    expectedLifespan: expectedLifespan || 80,
    quote: quote || "Memento Mori",
    notes: notes || "",
    bgColor: bgColor || "#050505",
    textColor: textColor || "#fafafa",
    decadeGoals: decadeGoals || {},
    avatar: avatar || null,
    bucketList: bucketList || [],
    gender: gender || null,
  };

  try {
    if (USE_KV) {
      const existingUser = await kv.get(`user:creds:${trimmedUsername}`);
      if (existingUser) {
        return res.status(409).json({ error: "このユーザーIDは既に使用されています。ログインをお試しください。" });
      }
      await kv.set(`user:creds:${trimmedUsername}`, { password_hash, id });
      await kv.set(`user:profile:${id}`, newUserData);
    } else {
      const stmt = db.prepare(
        "INSERT INTO users (id, username, password_hash, name, birth_date, expected_lifespan, quote, notes, bg_color, text_color, decade_goals, avatar, bucket_list, gender, memos, favorites) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(
        id, trimmedUsername, password_hash, newUserData.name, newUserData.birthDate, newUserData.expectedLifespan, newUserData.quote, newUserData.notes, newUserData.bgColor, newUserData.textColor, JSON.stringify(newUserData.decadeGoals), newUserData.avatar, JSON.stringify(newUserData.bucketList), newUserData.gender, '[]', '[]'
      );
    }
    res.json({ ...newUserData, shareToken: null });
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "このユーザーIDは既に使用されています。ログインをお試しください。" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  if (!trimmedUsername || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (checkRateLimit(`login:${trimmedUsername}`)) {
    return res.status(429).json({ error: "ログイン試行回数が多すぎます。15分後に再試行してください。" });
  }

  try {
    if (USE_KV) {
      const creds: any = await kv.get(`user:creds:${trimmedUsername}`);
      if (!creds || !verifyPassword(password, creds.password_hash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      // Migrate legacy SHA-256 to scrypt on successful login
      if (!creds.password_hash.includes(':')) {
        await kv.set(`user:creds:${trimmedUsername}`, { ...creds, password_hash: hashPassword(password) });
      }
      const profile = await kv.get(`user:profile:${creds.id}`);
      return res.json(profile);
    } else {
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(trimmedUsername) as any;
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      // Migrate legacy SHA-256 to scrypt on successful login
      if (!user.password_hash.includes(':')) {
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), user.id);
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
        bucketList: user.bucket_list ? JSON.parse(user.bucket_list) : [],
        gender: user.gender || null,
        memos: user.memos ? JSON.parse(user.memos) : [],
        favorites: user.favorites ? JSON.parse(user.favorites) : [],
        shareToken: user.share_token || null,
        purpose: user.purpose || '',
        capitalScores: user.capital_scores ? JSON.parse(user.capital_scores) : null,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  const { name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList, gender, memos, favorites, purpose, capitalScores } = req.body;

  try {
    if (USE_KV) {
      const existingProfile: any = await kv.get(`user:profile:${id}`);
      if (!existingProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedData = { ...existingProfile, name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals, avatar, bucketList, gender, memos, favorites, purpose, capitalScores };
      await kv.set(`user:profile:${id}`, updatedData);
      return res.json({ success: true });
    } else {
      const stmt = db.prepare(
        "UPDATE users SET name = ?, birth_date = ?, expected_lifespan = ?, quote = ?, notes = ?, bg_color = ?, text_color = ?, decade_goals = ?, avatar = ?, bucket_list = ?, gender = ?, memos = ?, favorites = ?, purpose = ?, capital_scores = ? WHERE id = ?"
      );
      const info = stmt.run(name, birthDate, expectedLifespan, quote, notes, bgColor, textColor, decadeGoals ? JSON.stringify(decadeGoals) : null, avatar || null, bucketList ? JSON.stringify(bucketList) : null, gender || null, memos ? JSON.stringify(memos) : '[]', favorites ? JSON.stringify(favorites) : '[]', purpose || null, capitalScores ? JSON.stringify(capitalScores) : null, id);
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

  try {
    if (USE_KV) {
      const existingProfile: any = await kv.get(`user:profile:${id}`);
      if (!existingProfile) return res.status(404).json({ error: "User not found" });

      const oldUsername = existingProfile.username;
      const creds: any = await kv.get(`user:creds:${oldUsername}`);

      if (!creds || !verifyPassword(currentPassword, creds.password_hash)) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      const updatedCreds = { ...creds };
      let newName = oldUsername;

      if (newPassword) {
        updatedCreds.password_hash = hashPassword(newPassword);
      } else if (!creds.password_hash.includes(':')) {
        // Migrate legacy SHA-256 to scrypt
        updatedCreds.password_hash = hashPassword(currentPassword);
      }

      if (newUsername && newUsername !== oldUsername) {
        const trimmedNew = newUsername.trim();
        if (!isValidUsername(trimmedNew)) {
          return res.status(400).json({ error: "ユーザーIDは3〜50文字の英数字・アンダースコア・ハイフンのみ使用できます" });
        }
        const usernameExists = await kv.get(`user:creds:${trimmedNew}`);
        if (usernameExists) return res.status(409).json({ error: "このユーザーIDは既に使用されています。ログインをお試しください。" });
        newName = trimmedNew;
      }

      if (newUsername && newUsername !== oldUsername) {
        await kv.del(`user:creds:${oldUsername}`);
        await kv.set(`user:creds:${newName}`, updatedCreds);
        const updatedProfile = { ...existingProfile, username: newName };
        await kv.set(`user:profile:${id}`, updatedProfile);
      } else {
        await kv.set(`user:creds:${newName}`, updatedCreds);
      }

      return res.json({ success: true, username: newName });
    } else {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      let newName = user.username;
      let newHash = user.password_hash;

      if (newPassword) {
        newHash = hashPassword(newPassword);
      } else if (!user.password_hash.includes(':')) {
        newHash = hashPassword(currentPassword);
      }

      if (newUsername && newUsername !== user.username) {
        const trimmedNew = newUsername.trim();
        if (!isValidUsername(trimmedNew)) {
          return res.status(400).json({ error: "ユーザーIDは3〜50文字の英数字・アンダースコア・ハイフンのみ使用できます" });
        }
        newName = trimmedNew;
      }

      const stmt = db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?");
      stmt.run(newName, newHash, id);
      return res.json({ success: true, username: newName });
    }
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "このユーザーIDは既に使用されています。ログインをお試しください。" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user account endpoint
app.delete("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ error: "パスワードが必要です" });
  }

  try {
    if (USE_KV) {
      const profile: any = await kv.get(`user:profile:${id}`);
      if (!profile) return res.status(404).json({ error: "User not found" });

      const creds: any = await kv.get(`user:creds:${profile.username}`);
      if (!creds || !verifyPassword(password, creds.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }

      await kv.del(`user:creds:${profile.username}`);
      await kv.del(`user:profile:${id}`);
      return res.json({ success: true });
    } else {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user) return res.status(404).json({ error: "User not found" });

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }

      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Share token: generate
app.post("/api/user/:id/share-token", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "パスワードが必要です" });

  try {
    if (USE_KV) {
      const profile: any = await kv.get(`user:profile:${id}`);
      if (!profile) return res.status(404).json({ error: "User not found" });
      const creds: any = await kv.get(`user:creds:${profile.username}`);
      if (!creds || !verifyPassword(password, creds.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }
      const token = crypto.randomBytes(32).toString('hex');
      await kv.set(`user:sharetoken:${token}`, { id });
      await kv.set(`user:profile:${id}`, { ...profile, shareToken: token });
      return res.json({ shareToken: token });
    } else {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare("UPDATE users SET share_token = ? WHERE id = ?").run(token, id);
      return res.json({ shareToken: token });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Share token: revoke
app.delete("/api/user/:id/share-token", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "パスワードが必要です" });

  try {
    if (USE_KV) {
      const profile: any = await kv.get(`user:profile:${id}`);
      if (!profile) return res.status(404).json({ error: "User not found" });
      const creds: any = await kv.get(`user:creds:${profile.username}`);
      if (!creds || !verifyPassword(password, creds.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }
      if (profile.shareToken) await kv.del(`user:sharetoken:${profile.shareToken}`);
      await kv.set(`user:profile:${id}`, { ...profile, shareToken: null });
      return res.json({ success: true });
    } else {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "パスワードが正しくありません" });
      }
      db.prepare("UPDATE users SET share_token = NULL WHERE id = ?").run(id);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: get profile
app.get("/api/share/:token", async (req, res) => {
  const { token } = req.params;
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      return res.json(profile);
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      return res.json(buildPublicProfile(user));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: add bucket item
app.post("/api/share/:token/bucket", async (req, res) => {
  const { token } = req.params;
  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: "text is required" });
  }
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const item = { id: crypto.randomUUID(), text: text.trim(), completed: false, createdAt: new Date().toISOString() };
      const bucketList = [...(profile.bucketList || []), item];
      await kv.set(`user:profile:${ref.id}`, { ...profile, bucketList });
      return res.json(item);
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      const bucketList = user.bucket_list ? JSON.parse(user.bucket_list) : [];
      const item = { id: crypto.randomUUID(), text: text.trim(), completed: false, createdAt: new Date().toISOString() };
      bucketList.push(item);
      db.prepare("UPDATE users SET bucket_list = ? WHERE share_token = ?").run(JSON.stringify(bucketList), token);
      return res.json(item);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: update bucket item
app.patch("/api/share/:token/bucket/:itemId", async (req, res) => {
  const { token, itemId } = req.params;
  const { text, completed } = req.body || {};
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const bucketList = (profile.bucketList || []).map((item: any) => {
        if (item.id !== itemId) return item;
        return { ...item, ...(text !== undefined ? { text } : {}), ...(completed !== undefined ? { completed } : {}) };
      });
      await kv.set(`user:profile:${ref.id}`, { ...profile, bucketList });
      return res.json({ success: true });
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      const bucketList = user.bucket_list ? JSON.parse(user.bucket_list) : [];
      const updated = bucketList.map((item: any) => {
        if (item.id !== itemId) return item;
        return { ...item, ...(text !== undefined ? { text } : {}), ...(completed !== undefined ? { completed } : {}) };
      });
      db.prepare("UPDATE users SET bucket_list = ? WHERE share_token = ?").run(JSON.stringify(updated), token);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: delete bucket item
app.delete("/api/share/:token/bucket/:itemId", async (req, res) => {
  const { token, itemId } = req.params;
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const bucketList = (profile.bucketList || []).filter((item: any) => item.id !== itemId);
      await kv.set(`user:profile:${ref.id}`, { ...profile, bucketList });
      return res.json({ success: true });
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      const bucketList = (user.bucket_list ? JSON.parse(user.bucket_list) : []).filter((item: any) => item.id !== itemId);
      db.prepare("UPDATE users SET bucket_list = ? WHERE share_token = ?").run(JSON.stringify(bucketList), token);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: add memo
app.post("/api/share/:token/memo", async (req, res) => {
  const { token } = req.params;
  const { content } = req.body || {};
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: "content is required" });
  }
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const memo = { id: crypto.randomUUID(), content: content.trim(), createdAt: new Date().toISOString() };
      const memos = [...(profile.memos || []), memo].slice(-50);
      await kv.set(`user:profile:${ref.id}`, { ...profile, memos });
      return res.json(memo);
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      const memos = user.memos ? JSON.parse(user.memos) : [];
      const memo = { id: crypto.randomUUID(), content: content.trim(), createdAt: new Date().toISOString() };
      memos.push(memo);
      const trimmed = memos.slice(-50);
      db.prepare("UPDATE users SET memos = ? WHERE share_token = ?").run(JSON.stringify(trimmed), token);
      return res.json(memo);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: update notes
app.put("/api/share/:token/notes", async (req, res) => {
  const { token } = req.params;
  const { notes } = req.body || {};
  if (typeof notes !== 'string') return res.status(400).json({ error: "notes must be a string" });
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await kv.set(`user:profile:${ref.id}`, { ...profile, notes });
      return res.json({ success: true });
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      db.prepare("UPDATE users SET notes = ? WHERE share_token = ?").run(notes, token);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public share API: update decade goal
app.put("/api/share/:token/goals", async (req, res) => {
  const { token } = req.params;
  const { decadeKey, goal } = req.body || {};
  if (!decadeKey || typeof goal !== 'string') {
    return res.status(400).json({ error: "decadeKey and goal are required" });
  }
  if (checkShareRateLimit(`share:${token}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます" });
  }
  try {
    if (USE_KV) {
      const ref: any = await kv.get(`user:sharetoken:${token}`);
      if (!ref) return res.status(404).json({ error: "Token not found" });
      const profile: any = await kv.get(`user:profile:${ref.id}`);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const decadeGoals = { ...(profile.decadeGoals || {}), [decadeKey]: goal };
      await kv.set(`user:profile:${ref.id}`, { ...profile, decadeGoals });
      return res.json({ success: true });
    } else {
      const user = getUserByShareToken(token);
      if (!user) return res.status(404).json({ error: "Token not found" });
      const decadeGoals = { ...(user.decade_goals ? JSON.parse(user.decade_goals) : {}), [decadeKey]: goal };
      db.prepare("UPDATE users SET decade_goals = ? WHERE share_token = ?").run(JSON.stringify(decadeGoals), token);
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
  if (prompt.length > 3000) {
    return res.status(400).json({ error: "プロンプトが長すぎます" });
  }

  const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || 'unknown';
  if (checkGroqRateLimit(`groq:${ip}`)) {
    return res.status(429).json({ error: "リクエストが多すぎます。しばらく待ってからお試しください。" });
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
