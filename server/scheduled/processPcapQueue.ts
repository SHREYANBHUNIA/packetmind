import type { Request, Response } from "express";
import { processNextQueuedPcapAnalysis } from "../pcapJobProcessor";
import { sdk } from "../_core/sdk";

/** Heartbeat callback: processes one durable PacketMind PCAP job per invocation. */
export async function processPcapQueue(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await processNextQueuedPcapAnalysis();
    return res.json({ ok: true, ...result, taskUid: user.taskUid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PacketMind queue processing failed.";
    console.error("[PacketMind] scheduled processor failed", error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
