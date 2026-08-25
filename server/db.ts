import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AnalysisRun, Capture, InsertUser, NetworkAnomaly, analysisRuns, captures, networkAnomalies, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function asRecord(value: Record<string, unknown> | null | undefined) { return value ?? {}; }

export async function createCapture(input: Pick<Capture, "userId" | "filename" | "networkLabel" | "storageKey" | "storageUrl" | "byteSize" | "mode">) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  const [row] = await db.insert(captures).values({ ...input, status: "uploaded" }).$returningId();
  return row.id;
}

export async function createAnalysisRun(captureId: number, userId: number, baselineCaptureId?: number) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  const [row] = await db.insert(analysisRuns).values({ captureId, userId, baselineCaptureId, status: "analyzing", stage: "queued", progress: 0 }).$returningId();
  await db.update(captures).set({ status: "analyzing" }).where(eq(captures.id, captureId));
  return row.id;
}

export async function claimNextQueuedAnalysis() {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  const rows = await db.select({ run: analysisRuns, capture: captures }).from(analysisRuns).innerJoin(captures, eq(analysisRuns.captureId, captures.id)).where(and(eq(analysisRuns.status, "analyzing"), eq(analysisRuns.stage, "queued"))).orderBy(analysisRuns.createdAt).limit(1);
  const job = rows[0];
  if (!job) return undefined;
  await db.update(analysisRuns).set({ stage: "parsing", progress: 8 }).where(and(eq(analysisRuns.id, job.run.id), eq(analysisRuns.stage, "queued")));
  return job;
}

export async function updateAnalysisStage(analysisId: number, stage: "queued" | "parsing" | "learning" | "detecting" | "complete" | "failed", progress: number) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  await db.update(analysisRuns).set({ stage, progress: Math.max(0, Math.min(100, progress)) }).where(eq(analysisRuns.id, analysisId));
}

export async function getCaptureForAnalysis(captureId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  const rows = await db.select().from(captures).where(and(eq(captures.id, captureId), eq(captures.userId, userId))).limit(1);
  return rows[0];
}

export async function retryAnalysisRun(analysisId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  const rows = await db.select({ run: analysisRuns, capture: captures }).from(analysisRuns).innerJoin(captures, eq(analysisRuns.captureId, captures.id)).where(and(eq(analysisRuns.id, analysisId), eq(analysisRuns.userId, userId))).limit(1);
  const record = rows[0];
  if (!record) throw new Error("The requested analysis run was not found.");
  if (record.run.status !== "failed") throw new Error("Only failed analysis runs can be retried.");
  await db.update(analysisRuns).set({ status: "analyzing", stage: "queued", progress: 0, failureReason: null, completedAt: null }).where(eq(analysisRuns.id, analysisId));
  await db.update(captures).set({ status: "analyzing", completedAt: null }).where(eq(captures.id, record.capture.id));
  return record;
}

export async function completeAnalysis(input: { captureId: number; analysisId: number; summary: Record<string, unknown>; baselineProfile: Record<string, unknown>; anomalies: Omit<NetworkAnomaly, "id" | "analysisId" | "createdAt">[] }) {
  const db = await getDb();
  if (!db) throw new Error("PacketMind database is unavailable.");
  await db.update(analysisRuns).set({ status: "ready", stage: "complete", progress: 100, failureReason: null, totalPackets: Number(input.summary.totalPackets ?? 0), totalFlows: Number(input.summary.totalFlows ?? 0), totalHosts: Number(input.summary.totalHosts ?? 0), totalBytes: Number(input.summary.totalBytes ?? 0), summary: input.summary, baselineProfile: input.baselineProfile, completedAt: new Date() }).where(eq(analysisRuns.id, input.analysisId));
  await db.update(captures).set({ status: "ready", summary: input.summary, completedAt: new Date() }).where(eq(captures.id, input.captureId));
  if (input.anomalies.length) await db.insert(networkAnomalies).values(input.anomalies.map(anomaly => ({ ...anomaly, analysisId: input.analysisId })));
}

export async function failAnalysis(captureId: number, analysisId: number, failureReason = "PacketMind could not analyze this capture.") {
  const db = await getDb();
  if (!db) return;
  await db.update(analysisRuns).set({ status: "failed", stage: "failed", failureReason, completedAt: new Date() }).where(eq(analysisRuns.id, analysisId));
  await db.update(captures).set({ status: "failed", completedAt: new Date() }).where(eq(captures.id, captureId));
}

export async function getLatestBaseline(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ capture: captures, run: analysisRuns }).from(analysisRuns).innerJoin(captures, eq(analysisRuns.captureId, captures.id)).where(and(eq(captures.userId, userId), eq(captures.mode, "learn"), eq(captures.status, "ready"))).orderBy(desc(captures.completedAt)).limit(1);
  return rows[0];
}

export async function getNetworkDashboard(userId: number) {
  const db = await getDb();
  if (!db) return { latest: null, anomalies: [], captures: [] };
  const latestRows = await db.select({ capture: captures, run: analysisRuns }).from(analysisRuns).innerJoin(captures, eq(analysisRuns.captureId, captures.id)).where(eq(analysisRuns.userId, userId)).orderBy(desc(analysisRuns.createdAt)).limit(1);
  const latest = latestRows[0];
  const anomalies = latest ? await db.select().from(networkAnomalies).where(eq(networkAnomalies.analysisId, latest.run.id)).orderBy(desc(networkAnomalies.score)).limit(24) : [];
  const userCaptures = await db.select().from(captures).where(eq(captures.userId, userId)).orderBy(desc(captures.createdAt)).limit(12);
  return { latest: latest ? { capture: { ...latest.capture, summary: asRecord(latest.capture.summary) }, run: { ...latest.run, summary: asRecord(latest.run.summary), baselineProfile: asRecord(latest.run.baselineProfile) } } : null, anomalies, captures: userCaptures.map(capture => ({ ...capture, summary: asRecord(capture.summary) })) };
}
