import { build } from "vite";
import { join, dirname } from "path";
import { rmSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

async function buildClient() {
  console.log("Building client...");
  await build({
    configFile: join(rootDir, "vite.config.ts"),
    root: join(rootDir, "client"),
    build: {
      outDir: join(rootDir, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
  });
}

async function buildServer() {
  console.log("Building server...");
  try {
    const result = await Bun.build({
      entrypoints: [join(rootDir, "server/index.ts")],
      outdir: join(rootDir, "dist/server"),
      target: "node",
      minify: true,
      splitting: false,
      external: [
        // Mark all node_modules as external
        "express",
        "ws",
        "drizzle-orm",
        "zod",
        "vite",
        "@vitejs/plugin-react",
        "@replit/vite-plugin-shadcn-theme-json",
        "@replit/vite-plugin-runtime-error-modal",
      ],
    });

    if (!result.success) {
      throw new Error("Server build failed");
    }
  } catch (error) {
    console.error("Server build error:", error);
    process.exit(1);
  }
}

async function main() {
  try {
    // Clean and recreate dist directory
    try {
      rmSync(join(rootDir, "dist"), { recursive: true, force: true });
      mkdirSync(join(rootDir, "dist"));
      mkdirSync(join(rootDir, "dist/server"));
      mkdirSync(join(rootDir, "dist/public"));
    } catch (error) {
      console.error("Failed to clean dist directory:", error);
    }

    // Build client and server
    await buildClient();
    await buildServer();

    // Copy necessary files
    await Bun.write(
      join(rootDir, "dist/server/package.json"),
      JSON.stringify(
        {
          type: "module",
          dependencies: {
            express: "^4.21.2",
            ws: "^8.18.0",
            "drizzle-orm": "^0.38.2",
            postgres: "^3.4.5",
            zod: "^3.23.8",
            vite: "^5.0.0",
            "@vitejs/plugin-react": "^4.2.0",
            "@replit/vite-plugin-shadcn-theme-json": "^0.0.4",
            "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
          },
        },
        null,
        2,
      ),
    );

    // Copy environment configuration
    try {
      const env = await Bun.file(join(rootDir, ".env.production")).text();
      await Bun.write(join(rootDir, "dist/server/.env"), env);
    } catch (error) {
      console.warn("No .env.production file found, skipping...");
    }

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

main();
