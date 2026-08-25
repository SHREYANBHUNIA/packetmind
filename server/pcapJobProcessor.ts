/** Durable PacketMind job processor. Every state transition is persisted so the
 * next scheduled run can safely continue processing queued captures. */
import { completeAnalysis, failAnalysis, getLatestBaseline, claimNextQueuedAnalysis, updateAnalysisStage } from "./db";
import { analyzePcap } from "./networkAnalysis";
import { storageGetSignedUrl } from "./storage";

export async function processNextQueuedPcapAnalysis() {
  const job = await claimNextQueuedAnalysis();
  if (!job) return { processed: false as const, message: "No queued captures." };
  try {
    await updateAnalysisStage(job.run.id, "parsing", 18);
    const signedUrl = await storageGetSignedUrl(job.capture.storageKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("The uploaded PCAP could not be retrieved from secure storage.");
    const bytes = Buffer.from(await response.arrayBuffer());
    await updateAnalysisStage(job.run.id, "learning", 48);
    const learned = job.capture.mode === "compare" ? await getLatestBaseline(job.run.userId) : undefined;
    await updateAnalysisStage(job.run.id, "detecting", 78);
    const result = analyzePcap(bytes, learned?.run.baselineProfile);
    await completeAnalysis({
      captureId: job.capture.id,
      analysisId: job.run.id,
      summary: result.summary,
      baselineProfile: result.baselineProfile as unknown as Record<string, unknown>,
      anomalies: result.anomalies.map(anomaly => ({ ...anomaly, service: anomaly.service, evidence: anomaly.evidence })),
    });
    return { processed: true as const, analysisId: job.run.id, anomalies: result.anomalies.length };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PacketMind could not process this capture.";
    await failAnalysis(job.capture.id, job.run.id, reason);
    return { processed: true as const, analysisId: job.run.id, failed: true as const, message: reason };
  }
}
