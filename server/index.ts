import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loadConfig } from "./config";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocket, WebSocketServer } from "ws";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware for logging API requests
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const config = loadConfig();
    let server = registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Environment-specific setup
    if (process.env.NODE_ENV === "production") {
      app.use(express.static(path.join(__dirname, "../public")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../public/index.html"));
      });
    } else {
      const vite = await import("vite");
      const viteServer = await vite.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(viteServer.middlewares);
    }

    // WebSocket setup
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws: WebSocket) => {
      ws.on("message", async (message: string) => {
        try {
          const data = JSON.parse(message);
          // Handle WebSocket messages
        } catch (error) {
          console.error("WebSocket error:", error);
        }
      });
    });

    // Start the server
    const port = config.port || 5000;
    const host = config.host || "0.0.0.0";

    server.listen(port, host, () => {
      log(
        `Server running in ${config.isDev ? "development" : "production"} mode`
      );
      log(`Server listening at http://${host}:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

const server = app.listen();
export default server;
