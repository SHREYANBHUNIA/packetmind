import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const captureMode = ["learn", "compare"] as const;
export const captureStatus = ["uploaded", "analyzing", "ready", "failed"] as const;
export const analysisStage = ["queued", "parsing", "learning", "detecting", "complete", "failed"] as const;
export const analysisSeverity = ["critical", "elevated", "watch"] as const;

/** Uploaded PCAP artifact and its user-selected learning role. File bytes always live in S3. */
export const captures = mysqlTable("captures", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  networkLabel: varchar("networkLabel", { length: 120 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  byteSize: int("byteSize").notNull(),
  mode: mysqlEnum("mode", captureMode).notNull(),
  status: mysqlEnum("status", captureStatus).notNull().default("uploaded"),
  summary: json("summary").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

/** A deterministic analysis result and the learned normal-behavior profile for one capture. */
export const analysisRuns = mysqlTable("analysisRuns", {
  id: int("id").autoincrement().primaryKey(),
  captureId: int("captureId").notNull().references(() => captures.id),
  userId: int("userId").notNull().references(() => users.id),
  baselineCaptureId: int("baselineCaptureId").references(() => captures.id),
  status: mysqlEnum("status", captureStatus).notNull().default("uploaded"),
  stage: mysqlEnum("stage", analysisStage).notNull().default("queued"),
  progress: int("progress").notNull().default(0),
  failureReason: text("failureReason"),
  totalPackets: int("totalPackets").notNull().default(0),
  totalFlows: int("totalFlows").notNull().default(0),
  totalHosts: int("totalHosts").notNull().default(0),
  totalBytes: int("totalBytes").notNull().default(0),
  baselineProfile: json("baselineProfile").$type<Record<string, unknown> | null>(),
  summary: json("summary").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

/** Immutable stage audit trail for explaining progress through an analysis run. */
export const analysisStageEvents = mysqlTable("analysisStageEvents", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull().references(() => analysisRuns.id),
  stage: mysqlEnum("stage", analysisStage).notNull(),
  progress: int("progress").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Individual explainable deviations surfaced by a completed analysis run. */
export const networkAnomalies = mysqlTable("networkAnomalies", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull().references(() => analysisRuns.id),
  score: int("score").notNull(),
  severity: mysqlEnum("severity", analysisSeverity).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  sourceHost: varchar("sourceHost", { length: 80 }).notNull(),
  target: varchar("target", { length: 200 }).notNull(),
  service: varchar("service", { length: 80 }).notNull(),
  anomalyType: varchar("anomalyType", { length: 100 }).notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  explanation: text("explanation").notNull(),
  seenAt: timestamp("seenAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Project-level ownership record for the durable PCAP processor heartbeat. */
export const workerSettings = mysqlTable("workerSettings", {
  id: int("id").autoincrement().primaryKey(),
  workerName: varchar("workerName", { length: 80 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).notNull(),
  enabled: int("enabled").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Capture = typeof captures.$inferSelect;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type NetworkAnomaly = typeof networkAnomalies.$inferSelect;
