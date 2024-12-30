import { z } from "zod";

const configSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().default(5000),
  isDev: z.boolean().default(false),
  corsOrigins: z.array(z.string()).default([]),
  maxConnections: z.number().default(100),
  transferChunkSize: z
    .number()
    .min(16384) // Minimum 16KB chunk size for efficiency
    .default(1048576), // 1MB default
  secretKey: z.string().default("development_secret"),
  publicDir: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const isDev = process.env.NODE_ENV !== "production";

  // Convert TRANSFER_CHUNK_SIZE from KB to bytes
  const chunkSizeKB = parseInt(process.env.TRANSFER_CHUNK_SIZE || "1024", 10);
  const chunkSizeBytes = chunkSizeKB * 1024; // Convert KB to bytes

  return configSchema.parse({
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5000", 10),
    isDev,
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : [],
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || "100", 10),
    transferChunkSize: chunkSizeBytes,
    secretKey: process.env.SECRET_KEY || "development_secret",
    publicDir: process.env.PUBLIC_DIR,
  });
}
