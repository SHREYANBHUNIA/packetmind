import { describe, expect, it } from "vitest";
import { analyzePcap } from "./networkAnalysis";

function pcapWithUdpFlow(source: [number, number, number, number], target: [number, number, number, number], targetPort: number) {
  const globalHeader = Buffer.alloc(24);
  globalHeader.writeUInt32LE(0xa1b2c3d4, 0); globalHeader.writeUInt16LE(2, 4); globalHeader.writeUInt16LE(4, 6); globalHeader.writeUInt32LE(65535, 16); globalHeader.writeUInt32LE(1, 20);
  const packet = Buffer.alloc(42);
  packet.writeUInt16BE(0x0800, 12); packet[14] = 0x45; packet.writeUInt16BE(28, 16); packet[23] = 17;
  Buffer.from(source).copy(packet, 26); Buffer.from(target).copy(packet, 30); packet.writeUInt16BE(51520, 34); packet.writeUInt16BE(targetPort, 36); packet.writeUInt16BE(8, 38);
  const recordHeader = Buffer.alloc(16); recordHeader.writeUInt32LE(1710000000, 0); recordHeader.writeUInt32LE(packet.length, 8); recordHeader.writeUInt32LE(packet.length, 12);
  return Buffer.concat([globalHeader, recordHeader, packet]);
}

describe("analyzePcap", () => {
  it("extracts flow metadata without reading packet payloads", () => {
    const analysis = analyzePcap(pcapWithUdpFlow([10, 1, 1, 10], [8, 8, 8, 8], 8443));
    expect(analysis.summary).toMatchObject({ totalPackets: 1, totalFlows: 1, totalHosts: 2 });
    expect(analysis.topFlows[0]).toMatchObject({ sourceHost: "10.1.1.10", targetHost: "8.8.8.8", targetPort: 8443, protocol: "UDP" });
    expect(analysis.anomalies.some(item => item.anomalyType === "rare_outbound_port")).toBe(true);
  });

  it("uses a learned service profile when comparing a later capture", () => {
    const baseline = analyzePcap(pcapWithUdpFlow([10, 1, 1, 10], [8, 8, 8, 8], 8443)).baselineProfile as unknown as Record<string, unknown>;
    const analysis = analyzePcap(pcapWithUdpFlow([10, 1, 1, 10], [8, 8, 8, 8], 445), baseline);
    expect(analysis.anomalies.some(item => item.anomalyType === "new_service")).toBe(true);
  });
});
