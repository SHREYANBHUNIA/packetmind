/** Durable PacketMind job processor. Every state transition is persisted so the
 * next scheduled run can safely continue processing queued captures. */
import { completeAnalysis, failAnalysis, getCaptureForAnalysis, getLatestBaseline, claimNextQueuedAnalysis, updateAnalysisStage } from "./db";
import { analyzePcap } from "./networkAnalysis";
import { storageGetSignedUrl } from "./storage";

export async function processStoredPcapAnalysis(input: { captureId: number; analysisId: number; userId: number }) {
  const capture = await getCaptureForAnalysis(input.captureId, input.userId);
  if (!capture) return { processed: false as const, failed: true as const, message: "The capture record is no longer available." };
  try {
    await updateAnalysisStage(input.analysisId, "parsing", 18);
    const signedUrl = await storageGetSignedUrl(capture.storageKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("The uploaded PCAP could not be retrieved from secure storage.");
    const bytes = Buffer.from(await response.arrayBuffer());
    await updateAnalysisStage(input.analysisId, "learning", 48);
    const learned = capture.mode === "compare" ? await getLatestBaseline(input.userId) : undefined;
    await updateAnalysisStage(input.analysisId, "detecting", 78);
    const result = analyzePcap(bytes, learned?.run.baselineProfile);
    await completeAnalysis({
      captureId: capture.id,
      analysisId: input.analysisId,
      summary: result.summary,
      baselineProfile: result.baselineProfile as unknown as Record<string, unknown>,
      anomalies: result.anomalies.map(anomaly => ({ ...anomaly, service: anomaly.service, evidence: anomaly.evidence })),
    });
    return { processed: true as const, analysisId: input.analysisId, anomalies: result.anomalies.length, summary: result.summary };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PacketMind could not process this capture.";
    await failAnalysis(capture.id, input.analysisId, reason);
    return { processed: true as const, analysisId: input.analysisId, failed: true as const, message: reason };
  }
}

export async function processNextQueuedPcapAnalysis() {
  const job = await claimNextQueuedAnalysis();
  if (!job) return { processed: false as const, message: "No queued captures." };
  return processStoredPcapAnalysis({ captureId: job.capture.id, analysisId: job.run.id, userId: job.run.userId });
}
