import { processNextQueuedPcapAnalysis } from "../server/pcapJobProcessor.ts";

const result = await processNextQueuedPcapAnalysis();
console.log(JSON.stringify(result));
