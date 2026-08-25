import { mkdirSync, writeFileSync } from "node:fs";

const outDir = "/home/ubuntu/webdev-static-assets";
const outPath = `${outDir}/packetmind-training-sample.pcap`;

function ipv4(address) {
  return Buffer.from(address.split(".").map(Number));
}

function makeUdpPacket(source, destination, sourcePort, destinationPort, payloadLength = 12) {
  const payload = Buffer.alloc(payloadLength, 0x42);
  const packet = Buffer.alloc(14 + 20 + 8 + payload.length);
  packet.fill(0x02, 0, 6);
  packet.fill(0x08, 6, 12);
  packet.writeUInt16BE(0x0800, 12);
  const ip = 14;
  packet[ip] = 0x45;
  packet.writeUInt16BE(20 + 8 + payload.length, ip + 2);
  packet[ip + 8] = 64;
  packet[ip + 9] = 17;
  ipv4(source).copy(packet, ip + 12);
  ipv4(destination).copy(packet, ip + 16);
  const udp = ip + 20;
  packet.writeUInt16BE(sourcePort, udp);
  packet.writeUInt16BE(destinationPort, udp + 2);
  packet.writeUInt16BE(8 + payload.length, udp + 4);
  payload.copy(packet, udp + 8);
  return packet;
}

function record(packet, seconds) {
  const header = Buffer.alloc(16);
  header.writeUInt32LE(seconds, 0);
  header.writeUInt32LE(0, 4);
  header.writeUInt32LE(packet.length, 8);
  header.writeUInt32LE(packet.length, 12);
  return Buffer.concat([header, packet]);
}

const globalHeader = Buffer.alloc(24);
globalHeader.writeUInt32LE(0xa1b2c3d4, 0);
globalHeader.writeUInt16LE(2, 4);
globalHeader.writeUInt16LE(4, 6);
globalHeader.writeInt32LE(0, 8);
globalHeader.writeUInt32LE(0, 12);
globalHeader.writeUInt32LE(65535, 16);
globalHeader.writeUInt32LE(1, 20);

const packets = [
  makeUdpPacket("10.20.4.15", "10.20.0.53", 51515, 53, 28),
  makeUdpPacket("10.20.4.15", "10.20.0.53", 51516, 53, 32),
  makeUdpPacket("10.20.4.15", "10.20.0.53", 51517, 53, 30),
  makeUdpPacket("10.20.4.22", "10.20.0.53", 52401, 53, 22),
  makeUdpPacket("10.20.4.22", "10.20.0.123", 52402, 123, 20),
  makeUdpPacket("10.20.4.15", "203.0.113.44", 51519, 8443, 48),
];

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, Buffer.concat([globalHeader, ...packets.map((packet, index) => record(packet, 1710000000 + index))]));
console.log(outPath);
