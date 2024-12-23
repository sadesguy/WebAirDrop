import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

export const transferLogs = pgTable("transfer_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sourceDevice: text("source_device").notNull(),
  targetDevice: text("target_device").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration").notNull(), // in milliseconds
  averageSpeed: integer("average_speed").notNull(), // in bytes per second
  success: boolean("success").notNull(),
  metadata: jsonb("metadata"), // For additional data like transfer mode, compression used, etc.
});

export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  deviceId: text("device_id").notNull(),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
});

export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  activeConnections: integer("active_connections").notNull(),
  peakConnections: integer("peak_connections").notNull(),
  totalBytesTransferred: integer("total_bytes_transferred").notNull(),
  activeTransfers: integer("active_transfers").notNull(),
  systemLoad: jsonb("system_load"), // CPU, memory, network stats
});

// Schema types
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertTransferLogSchema = createInsertSchema(transferLogs);
export const selectTransferLogSchema = createSelectSchema(transferLogs);
export const insertErrorLogSchema = createInsertSchema(errorLogs);
export const selectErrorLogSchema = createSelectSchema(errorLogs);
export const insertSystemMetricSchema = createInsertSchema(systemMetrics);
export const selectSystemMetricSchema = createSelectSchema(systemMetrics);

// Type exports
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertTransferLog = typeof transferLogs.$inferInsert;
export type SelectTransferLog = typeof transferLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type SelectErrorLog = typeof errorLogs.$inferSelect;
export type InsertSystemMetric = typeof systemMetrics.$inferInsert;
export type SelectSystemMetric = typeof systemMetrics.$inferSelect;