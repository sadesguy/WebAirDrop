import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// No Vite in production - serve static files
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Set production environment
process.env.NODE_ENV = "production";

// Import server from dist directory
import(join(__dirname, "../dist/server/index.js")).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
function join(...paths: string[]): string {
  return path.join(...paths);
}
