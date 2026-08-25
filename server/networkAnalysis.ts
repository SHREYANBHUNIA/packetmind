/**
 * PacketMind deterministic PCAP metadata analyzer. It intentionally reads packet
 * headers only: no payload is persisted or inspected. Classic PCAP Ethernet/RAW
 * captures are supported in this MVP; PCAPNG is rejected with a clear message.
 */
export type AnalysisSeverity = "critical" | "elevated" | "watch";

export type FlowRecord = {
  sourceHost: string;
  targetHost: string;
  sourcePort: number | null;
  targetPort: number | null;
  protocol: string;
  packetCount: number;
  byteCount: number;
  firstSeen: Date;
  lastSeen: Date;
};

export type BaselineProfile = {
  version: 1;
  hosts: Record<string, { peers: string[]; services: string[]; meanFlowBytes: number }>;
  medianFlowBytes: number;
};

export type DetectedAnomaly = {
  score: number;
  severity: AnalysisSeverity;
  title: string;
  sourceHost: string;
  target: string;
  service: string;
  anomalyType: string;
  evidence: string[];
  explanation: string;
  seenAt: Date;
};

export type PcapAnalysis = {
  summary: { totalPackets: number; totalFlows: number; totalHosts: number; totalBytes: number; externalPeers: number };
  baselineProfile: BaselineProfile;
  anomalies: DetectedAnomaly[];
  topFlows: FlowRecord[];
};

type ParsedPacket = { timestamp: Date; byteCount: number; sourceHost: string; targetHost: string; sourcePort: number | null; targetPort: number | null; protocol: string };

const serviceName = (protocol: string, port: number | null) => {
  if (port === null) return protocol;
  const wellKnown: Record<number, string> = { 53: "dns", 80: "http", 123: "ntp", 443: "https", 445: "smb", 22: "ssh", 3389: "rdp" };
  return `${protocol.toLowerCase()}/${wellKnown[port] ?? port}`;
};

const privateAddress = (address: string) => {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
};

function readIpv4(packet: Buffer, offset: number, timestamp: Date, byteCount: number): ParsedPacket | null {
  if (packet.length < offset + 20 || packet[offset] >> 4 !== 4) return null;
  const ihl = (packet[offset] & 0x0f) * 4;
  if (ihl < 20 || packet.length < offset + ihl) return null;
  const protocolNumber = packet[offset + 9];
  const protocol = protocolNumber === 6 ? "TCP" : protocolNumber === 17 ? "UDP" : protocolNumber === 1 ? "ICMP" : `IP-${protocolNumber}`;
  const sourceHost = `${packet[offset + 12]}.${packet[offset + 13]}.${packet[offset + 14]}.${packet[offset + 15]}`;
  const targetHost = `${packet[offset + 16]}.${packet[offset + 17]}.${packet[offset + 18]}.${packet[offset + 19]}`;
  const transportOffset = offset + ihl;
  const hasPorts = (protocolNumber === 6 || protocolNumber === 17) && packet.length >= transportOffset + 4;
  return {
    timestamp,
    byteCount,
    sourceHost,
    targetHost,
    sourcePort: hasPorts ? packet.readUInt16BE(transportOffset) : null,
    targetPort: hasPorts ? packet.readUInt16BE(transportOffset + 2) : null,
    protocol,
  };
}

function parseClassicPcap(buffer: Buffer): ParsedPacket[] {
  if (buffer.length < 24) throw new Error("The uploaded file is too small to be a PCAP capture.");
  const magic = buffer.readUInt32BE(0);
  if (magic === 0x0a0d0d0a) throw new Error("PCAPNG is not supported by this MVP. Export the capture as classic PCAP and try again.");
  const littleEndian = magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1;
  const bigEndian = magic === 0xa1b2c3d4 || magic === 0xa1b23c4d;
  if (!littleEndian && !bigEndian) throw new Error("PacketMind expected a classic PCAP file but could not recognize its capture header.");
  const read32 = (offset: number) => littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const linkType = read32(20);
  if (linkType !== 1 && linkType !== 101) throw new Error(`Unsupported PCAP link type ${linkType}. Use Ethernet or RAW IP captures for this MVP.`);

  const packets: ParsedPacket[] = [];
  let offset = 24;
  while (offset + 16 <= buffer.length) {
    const seconds = read32(offset);
    const capturedLength = read32(offset + 8);
    const originalLength = read32(offset + 12);
    const packetStart = offset + 16;
    if (capturedLength === 0 || packetStart + capturedLength > buffer.length) break;
    const packet = buffer.subarray(packetStart, packetStart + capturedLength);
    const timestamp = new Date(seconds * 1000);
    let ipOffset = 0;
    if (linkType === 1) {
      if (packet.length < 14) { offset = packetStart + capturedLength; continue; }
      let etherType = packet.readUInt16BE(12);
      ipOffset = 14;
      if ((etherType === 0x8100 || etherType === 0x88a8) && packet.length >= 18) { etherType = packet.readUInt16BE(16); ipOffset = 18; }
      if (etherType !== 0x0800) { offset = packetStart + capturedLength; continue; }
    }
    const parsed = readIpv4(packet, ipOffset, timestamp, originalLength || capturedLength);
    if (parsed) packets.push(parsed);
    offset = packetStart + capturedLength;
  }
  if (packets.length === 0) throw new Error("No IPv4 traffic metadata was found. PacketMind currently expects Ethernet or RAW IPv4 traffic in a classic PCAP.");
  return packets;
}

function createBaseline(flows: FlowRecord[]): BaselineProfile {
  const perHost = new Map<string, { peers: Set<string>; services: Set<string>; byteTotal: number; flowCount: number }>();
  for (const flow of flows) {
    const current = perHost.get(flow.sourceHost) ?? { peers: new Set(), services: new Set(), byteTotal: 0, flowCount: 0 };
    current.peers.add(flow.targetHost);
    current.services.add(serviceName(flow.protocol, flow.targetPort));
    current.byteTotal += flow.byteCount;
    current.flowCount += 1;
    perHost.set(flow.sourceHost, current);
  }
  return {
    version: 1,
    medianFlowBytes: median(flows.map(flow => flow.byteCount)),
    hosts: Object.fromEntries(Array.from(perHost.entries()).map(([host, entry]) => [host, { peers: Array.from(entry.peers).sort().slice(0, 32), services: Array.from(entry.services).sort().slice(0, 32), meanFlowBytes: Math.round(entry.byteTotal / entry.flowCount) }])),
  };
}

function normalizeBaseline(value: Record<string, unknown> | null | undefined): BaselineProfile | null {
  if (!value || value.version !== 1 || typeof value.hosts !== "object" || value.hosts === null) return null;
  return value as unknown as BaselineProfile;
}

function detectAnomalies(flows: FlowRecord[], baseline: BaselineProfile | null): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const seen = new Set<string>();
  const hostPeers = new Map<string, Set<string>>();
  for (const flow of flows) { const peers = hostPeers.get(flow.sourceHost) ?? new Set<string>(); peers.add(flow.targetHost); hostPeers.set(flow.sourceHost, peers); }
  const add = (anomaly: DetectedAnomaly) => { const key = `${anomaly.anomalyType}:${anomaly.sourceHost}:${anomaly.target}`; if (!seen.has(key) && anomalies.length < 24) { seen.add(key); anomalies.push(anomaly); } };

  for (const flow of flows) {
    const service = serviceName(flow.protocol, flow.targetPort);
    const target = `${flow.targetHost}${flow.targetPort !== null ? `:${flow.targetPort}` : ""}`;
    const profile = baseline?.hosts[flow.sourceHost];
    if (profile && !profile.peers.includes(flow.targetHost)) {
      add({ score: 86, severity: "elevated", title: "New destination peer", sourceHost: flow.sourceHost, target, service, anomalyType: "new_peer", evidence: ["Destination absent from learned peer set", `${profile.peers.length} baseline peers`, `${flow.packetCount} packets observed`], explanation: `${flow.sourceHost} contacted ${flow.targetHost}, a peer not present in its learned communication baseline.`, seenAt: flow.firstSeen });
    }
    if (profile && !profile.services.includes(service)) {
      add({ score: 81, severity: "elevated", title: "Unseen service behavior", sourceHost: flow.sourceHost, target, service, anomalyType: "new_service", evidence: [`${service} not observed in baseline`, `Known services: ${profile.services.slice(0, 3).join(", ") || "none"}`, `${flow.byteCount.toLocaleString()} bytes transferred`], explanation: `${flow.sourceHost} used ${service}, which falls outside the host's learned service profile.`, seenAt: flow.firstSeen });
    }
    if (profile && profile.meanFlowBytes > 0 && flow.byteCount > profile.meanFlowBytes * 4) {
      add({ score: 90, severity: "critical", title: "Transfer volume spike", sourceHost: flow.sourceHost, target, service, anomalyType: "volume_spike", evidence: [`${flow.byteCount.toLocaleString()} bytes in flow`, `${Math.round(flow.byteCount / profile.meanFlowBytes)}× learned mean`, `${flow.packetCount} packets observed`], explanation: `${flow.sourceHost} sent materially more traffic than expected for its learned flow profile.`, seenAt: flow.firstSeen });
    }
    if (!baseline && privateAddress(flow.sourceHost) && !privateAddress(flow.targetHost) && flow.targetPort !== null && ![53, 80, 123, 443].includes(flow.targetPort)) {
      add({ score: 78, severity: "watch", title: "Unusual outbound service", sourceHost: flow.sourceHost, target, service, anomalyType: "rare_outbound_port", evidence: ["External destination", `Port ${flow.targetPort} is outside the initial allow profile`, `${flow.byteCount.toLocaleString()} bytes transferred`], explanation: `${flow.sourceHost} used a less common outbound service while the network baseline is being established.`, seenAt: flow.firstSeen });
    }
  }
  for (const [host, peers] of Array.from(hostPeers.entries())) {
    if (peers.size >= 8) add({ score: 84, severity: "elevated", title: "High peer fan-out", sourceHost: host, target: `${peers.size} distinct hosts`, service: "multi-service", anomalyType: "fan_out", evidence: [`${peers.size} unique peers`, "Observed in a single capture", "Inspect for discovery or sweep behavior"], explanation: `${host} communicated with an unusually broad set of peers inside one capture window.`, seenAt: flows.find(flow => flow.sourceHost === host)?.firstSeen ?? new Date() });
  }
  return anomalies.sort((a, b) => b.score - a.score);
}

export function analyzePcap(buffer: Buffer, baselineValue?: Record<string, unknown> | null): PcapAnalysis {
  const packets = parseClassicPcap(buffer);
  const flows = new Map<string, FlowRecord>();
  const hosts = new Set<string>();
  const externalPeers = new Set<string>();
  let totalBytes = 0;
  for (const packet of packets) {
    const key = [packet.sourceHost, packet.sourcePort ?? "-", packet.targetHost, packet.targetPort ?? "-", packet.protocol].join("|");
    const flow = flows.get(key) ?? { sourceHost: packet.sourceHost, targetHost: packet.targetHost, sourcePort: packet.sourcePort, targetPort: packet.targetPort, protocol: packet.protocol, packetCount: 0, byteCount: 0, firstSeen: packet.timestamp, lastSeen: packet.timestamp };
    flow.packetCount += 1; flow.byteCount += packet.byteCount; flow.lastSeen = packet.timestamp;
    flows.set(key, flow); hosts.add(packet.sourceHost); hosts.add(packet.targetHost); totalBytes += packet.byteCount;
    if (!privateAddress(packet.targetHost)) externalPeers.add(packet.targetHost);
  }
  const flowRecords = Array.from(flows.values()).sort((a, b) => b.byteCount - a.byteCount);
  const baseline = normalizeBaseline(baselineValue);
  return { summary: { totalPackets: packets.length, totalFlows: flowRecords.length, totalHosts: hosts.size, totalBytes, externalPeers: externalPeers.size }, baselineProfile: createBaseline(flowRecords), anomalies: detectAnomalies(flowRecords, baseline), topFlows: flowRecords.slice(0, 12) };
}
