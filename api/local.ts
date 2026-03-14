import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./index.js";

async function startServer() {
  const PORT = 3000;
  
  // Create an express app wrapper
  const server = express();
  
  // Use our API functions 
  // (index.ts exports an Express router/app mounted on root)
  server.use(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    server.use(vite.middlewares);
  } else {
    server.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Local dev server running on http://localhost:${PORT}`);
  });
}

startServer();
