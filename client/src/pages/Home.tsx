/**
 * PacketMind — The Signal Ledger: a left observatory rail, an asymmetric investigation
 * field, Signal Amber exception cues, and cyan packet-path telemetry.
 */
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Boxes,
  ChevronDown,
  CircleDotDashed,
  Clock3,
  Command,
  Database,
  FileClock,
  GitBranch,
  Globe2,
  LayoutDashboard,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Radio,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "1H" | "24H" | "7D";
type Severity = "critical" | "elevated" | "watch";

type Anomaly = {
  id: string;
  time: string;
  title: string;
  source: string;
  target: string;
  score: number;
  severity: Severity;
  explanation: string;
  evidence: string[];
};

const rangeMetrics: Record<Range, { traffic: string; trafficDelta: string; hosts: string; anomalies: string; signal: string }> = {
  "1H": { traffic: "642 GB", trafficDelta: "+7.6%", hosts: "184", anomalies: "03", signal: "0.83" },
  "24H": { traffic: "14.2 TB", trafficDelta: "+12.8%", hosts: "1,248", anomalies: "17", signal: "0.86" },
  "7D": { traffic: "97.8 TB", trafficDelta: "+4.2%", hosts: "3,602", anomalies: "54", signal: "0.88" },
};

const anomalies: Anomaly[] = [
  {
    id: "AN-0482",
    time: "14:26:09",
    title: "Unusual outbound service",
    source: "10.14.8.23",
    target: "185.199.110.153:8443",
    score: 0.94,
    severity: "critical",
    explanation: "This endpoint has not contacted this service in the prior 30-day baseline. The transfer volume is 18.7× above its peer cohort median.",
    evidence: ["New destination ASN", "TLS client fingerprint drift", "1.8 GB in 8m 16s"],
  },
  {
    id: "AN-0479",
    time: "14:19:42",
    title: "Lateral SMB sweep",
    source: "10.14.8.23",
    target: "12 internal hosts:445",
    score: 0.89,
    severity: "elevated",
    explanation: "Connection fan-out climbed beyond the learned workstation pattern. Twelve internal SMB targets were reached in 74 seconds.",
    evidence: ["12 new peers", "Port 445 fan-out", "Burst interval 74s"],
  },
  {
    id: "AN-0473",
    time: "14:02:17",
    title: "Rare DNS request class",
    source: "10.14.22.61",
    target: "resolver.prod:53",
    score: 0.71,
    severity: "watch",
    explanation: "TXT request size exceeds the host’s historical 99th percentile and falls outside the usual engineering subnet profile.",
    evidence: ["1,042 byte query", "Rare query type", "Deviation +3.1σ"],
  },
];

const trafficTrend = [
  { time: "00", traffic: 34, baseline: 31 },
  { time: "03", traffic: 26, baseline: 29 },
  { time: "06", traffic: 38, baseline: 36 },
  { time: "09", traffic: 59, baseline: 52 },
  { time: "12", traffic: 71, baseline: 64 },
  { time: "15", traffic: 88, baseline: 69 },
  { time: "18", traffic: 73, baseline: 62 },
  { time: "21", traffic: 49, baseline: 47 },
];

const trafficClusters = [
  { name: "Business apps", amount: "41%", color: "#79DCE0" },
  { name: "Data services", amount: "29%", color: "#8fa0ad" },
  { name: "Developer tools", amount: "21%", color: "#566370" },
  { name: "Outlier traffic", amount: "9%", color: "#F6B73C" },
];

const navGroups: { label: string; items: { icon: typeof LayoutDashboard; name: string; active?: boolean; count?: string }[] }[] = [
  {
    label: "Observe",
    items: [
      { icon: LayoutDashboard, name: "Overview", active: true },
      { icon: Network, name: "Network map" },
      { icon: Activity, name: "Flow explorer" },
    ],
  },
  {
    label: "Investigate",
    items: [
      { icon: ShieldAlert, name: "Anomalies", count: "17" },
      { icon: GitBranch, name: "Behavior clusters" },
      { icon: FileClock, name: "Historical compare" },
    ],
  },
];

function MetricCard({ label, value, detail, accent, icon: Icon }: { label: string; value: string; detail: string; accent?: "amber" | "cyan"; icon: typeof Activity }) {
  const accentStyle = accent === "amber" ? "text-[#f6b73c]" : accent === "cyan" ? "text-[#79dce0]" : "text-slate-300";
  return (
    <div className="instrument-panel group relative min-w-[154px] overflow-hidden rounded-xl px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="mb-4 flex items-center justify-between">
        <span className="panel-label">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accentStyle}`} strokeWidth={1.8} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[21px] font-bold tracking-[-0.05em] text-slate-100">{value}</span>
        <span className={`mb-1 font-mono text-[10px] ${accentStyle}`}>{detail}</span>
      </div>
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  const colors = { critical: "bg-[#f16f62]", elevated: "bg-[#f6b73c]", watch: "bg-[#79dce0]" };
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${colors[severity]}`} />;
}

function NetworkGraph({ live, selectedHost, onHostSelect }: { live: boolean; selectedHost: string; onHostSelect: (host: string) => void }) {
  const nodes = [
    { id: "10.14.8.23", label: "FIN-WS-023", x: 172, y: 206, r: 15, type: "alert" },
    { id: "10.14.21.7", label: "PAYROLL-01", x: 322, y: 125, r: 11, type: "core" },
    { id: "10.14.8.51", label: "ENG-WS-051", x: 331, y: 277, r: 9, type: "normal" },
    { id: "10.14.22.61", label: "DEV-WS-061", x: 460, y: 229, r: 12, type: "watch" },
    { id: "10.14.0.12", label: "DNS-RESOLVER", x: 530, y: 100, r: 10, type: "core" },
    { id: "185.199.110.153", label: "EXT-8443", x: 660, y: 164, r: 14, type: "remote" },
    { id: "10.14.0.17", label: "FILE-CLUSTER", x: 536, y: 310, r: 11, type: "normal" },
  ];
  const edges = [
    [172, 206, 322, 125, "cyan"], [172, 206, 331, 277, "cyan"], [172, 206, 460, 229, "amber"], [172, 206, 660, 164, "amber"], [322, 125, 530, 100, "cyan"], [460, 229, 536, 310, "cyan"], [460, 229, 530, 100, "cyan"], [536, 310, 660, 164, "muted"],
  ] as const;
  const color = (type: string) => ({ alert: "#f6b73c", core: "#79dce0", normal: "#8b98a5", watch: "#d0b46f", remote: "#ef806c" }[type] ?? "#8b98a5");

  return (
    <svg viewBox="0 0 760 390" className="h-full w-full min-h-[315px]" role="img" aria-label="Network communication graph">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[72, 152, 232, 312].map((y) => <line key={y} x1="28" y1={y} x2="732" y2={y} stroke="rgba(148,163,184,.08)" strokeWidth="1" />)}
      {[92, 212, 332, 452, 572, 692].map((x) => <line key={x} x1={x} y1="30" x2={x} y2="358" stroke="rgba(148,163,184,.055)" strokeWidth="1" />)}
      {edges.map(([x1, y1, x2, y2, status], index) => (
        <g key={index}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={status === "amber" ? "rgba(246,183,60,.55)" : status === "cyan" ? "rgba(121,220,224,.36)" : "rgba(139,152,165,.24)"} strokeWidth={status === "amber" ? 1.75 : 1.15} />
          {live && status !== "muted" && <line className="packet-flow" x1={x1} y1={y1} x2={x2} y2={y2} stroke={status === "amber" ? "#f6b73c" : "#79dce0"} strokeWidth="1.6" strokeLinecap="round" />}
        </g>
      ))}
      {nodes.map((node) => {
        const selected = selectedHost === node.id;
        return (
          <g key={node.id} onClick={() => onHostSelect(node.id)} className="cursor-pointer" aria-label={`Inspect host ${node.label}`} role="button" tabIndex={0}>
            {node.type === "alert" && <circle cx={node.x} cy={node.y} r={node.r + 10} fill="none" stroke="#f6b73c" strokeOpacity=".35" className={live ? "live-pulse" : ""} />}
            <circle cx={node.x} cy={node.y} r={node.r + (selected ? 5 : 2)} fill="rgba(13,16,21,.88)" stroke={color(node.type)} strokeOpacity={selected ? "1" : ".36"} strokeWidth={selected ? 2 : 1} />
            <circle cx={node.x} cy={node.y} r={node.r} fill={color(node.type)} fillOpacity={node.type === "normal" ? ".65" : ".92"} filter={node.type === "alert" ? "url(#glow)" : undefined} />
            <circle cx={node.x} cy={node.y} r={node.r - 4} fill="#11151b" fillOpacity=".75" />
            <text x={node.x} y={node.y + node.r + 15} fill={selected ? "#e9edf0" : "#9aa6b4"} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono, monospace">{node.label}</text>
          </g>
        );
      })}
      <text x="29" y="25" fill="#6b7280" fontSize="9" fontFamily="IBM Plex Mono, monospace">ORIGIN / 10.14.0.0/16</text>
      <text x="610" y="348" fill="#6b7280" fontSize="9" fontFamily="IBM Plex Mono, monospace">EGRESS / ASN 54113</text>
    </svg>
  );
}

export default function Home() {
  const [range, setRange] = useState<Range>("24H");
  const [liveCapture, setLiveCapture] = useState(true);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState("AN-0482");
  const [selectedHost, setSelectedHost] = useState("10.14.8.23");
  const [replay, setReplay] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const metric = rangeMetrics[range];
  const selectedAnomaly = useMemo(() => anomalies.find((item) => item.id === selectedAnomalyId) ?? anomalies[0], [selectedAnomalyId]);

  useEffect(() => {
    if (replay <= 0 || replay >= 100) return;
    const timer = window.setTimeout(() => setReplay((value) => Math.min(value + 11, 100)), 230);
    return () => window.clearTimeout(timer);
  }, [replay]);

  useEffect(() => {
    if (replay !== 100) return;
    toast.success("Replay complete", { description: "3 anomalies surfaced in the 5-minute PCAP sample." });
    const timer = window.setTimeout(() => setReplay(0), 2400);
    return () => window.clearTimeout(timer);
  }, [replay]);

  const selectHost = (host: string) => {
    setSelectedHost(host);
    const related = host === "10.14.22.61" ? "AN-0473" : host === "185.199.110.153" ? "AN-0482" : "AN-0482";
    setSelectedAnomalyId(related);
  };

  const toggleCapture = () => {
    setLiveCapture((value) => !value);
    toast(liveCapture ? "Live capture paused" : "Live capture resumed", { description: liveCapture ? "Packet paths are frozen at the current observation." : "Streaming metadata has resumed from 3 sensors." });
  };

  return (
    <div className="min-h-screen bg-[#0d1015] text-slate-100 selection:bg-[#f6b73c]/30">
      <div className="flex min-h-screen">
        <aside className="desktop-nav sticky top-0 flex h-screen w-[244px] shrink-0 flex-col border-r border-white/[0.08] bg-[#101319] px-4 py-5">
          <div className="mb-8 flex items-center gap-2.5 px-1">
            <img src="/manus-storage/packetmind-brand-mark_bb627a57.png" alt="PacketMind" className="h-9 w-9 rounded-[10px] bg-[#f6b73c]/10 object-contain p-1" />
            <div>
              <div className="text-[15px] font-extrabold tracking-[-0.04em] text-slate-100">Packet<span className="wordmark-m">M</span>ind</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">network intelligence</div>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="panel-label text-[9px]">Environment</span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-[#79dce0]" />Production / us-east-1</div>
          </div>

          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 panel-label text-[9px]">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.name} onClick={() => item.active ? null : toast("View queued", { description: `${item.name} is represented in this overview prototype.` })} className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${item.active ? "bg-[#f6b73c]/10 text-[#f7c967]" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-200"}`}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /><span className="flex-1">{item.name}</span>{item.count && <span className="rounded bg-[#f6b73c]/12 px-1.5 py-0.5 font-mono text-[9px] text-[#f7c967]">{item.count}</span>}</button>;
                })}
              </div>
            ))}
          </nav>

          <div className="mt-auto">
            <div className="mb-3 border-t border-white/[0.07]" />
            <div className="mb-4 flex items-center gap-2 px-2">
              <div className="relative h-7 w-7 overflow-hidden rounded-full bg-gradient-to-br from-slate-500 to-slate-700"><span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-100">AR</span></div>
              <div><div className="text-[11px] font-semibold text-slate-300">Ari Rogers</div><div className="font-mono text-[9px] text-slate-500">Security analyst</div></div>
              <MoreHorizontal className="ml-auto h-4 w-4 text-slate-600" />
            </div>
            <button onClick={() => toast("Settings", { description: "Configuration actions are not enabled in this frontend prototype." })} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[11px] text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"><Settings2 className="h-3.5 w-3.5" />Workspace settings</button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 lg:px-7">
            <div>
              <div className="mb-1 flex items-center gap-2"><span className="panel-label">Observatory</span><span className="h-1 w-1 rounded-full bg-slate-600" /><span className="font-mono text-[10px] text-slate-500">baseline window: 30d</span></div>
              <h1 className="text-[19px] font-extrabold tracking-[-0.05em] text-slate-100">Traffic shape is widening</h1>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center rounded-md border border-white/[0.08] bg-white/[0.025] p-0.5 sm:flex">
                {(["1H", "24H", "7D"] as Range[]).map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded px-2.5 py-1.5 font-mono text-[10px] transition-colors ${range === item ? "bg-white/[0.09] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>{item}</button>)}
              </div>
              <button onClick={() => setSearchOpen(true)} className="hidden h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[11px] text-slate-500 transition-colors hover:border-white/[0.15] hover:text-slate-300 md:flex"><Search className="h-3.5 w-3.5" />Search <span className="ml-3 rounded border border-white/10 px-1 font-mono text-[9px]">⌘ K</span></button>
              <button onClick={() => toast("Notification center", { description: "You have 2 new anomaly notifications." })} aria-label="Open notifications" className="relative grid h-8 w-8 place-items-center rounded-md border border-white/[0.08] bg-white/[0.025] text-slate-400 transition-colors hover:text-slate-200"><BellRing className="h-3.5 w-3.5" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f6b73c]" /></button>
              <button onClick={toggleCapture} className={`flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-semibold transition-all active:scale-[.97] ${liveCapture ? "bg-[#79dce0] text-[#102028] hover:bg-[#95e8eb]" : "bg-slate-700 text-slate-100 hover:bg-slate-600"}`}><Radio className={`h-3.5 w-3.5 ${liveCapture ? "live-pulse" : ""}`} />{liveCapture ? "Live capture" : "Capture paused"}</button>
            </div>
          </header>

          <div className="mx-auto max-w-[1700px] px-5 py-5 lg:px-7 lg:py-6">
            <section className="mb-5 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div className="flex flex-wrap gap-3">
                <MetricCard label="Traffic observed / 24H" value={metric.traffic} detail={metric.trafficDelta} accent="cyan" icon={ArrowUpRight} />
                <MetricCard label="Active hosts / NOW" value={metric.hosts} detail="+18 now" icon={Globe2} />
                <MetricCard label="Anomalies / 24H" value={metric.anomalies} detail="3 critical" accent="amber" icon={AlertTriangle} />
                <MetricCard label="Baseline fit / 30D" value={metric.signal} detail="high confidence" accent="cyan" icon={CircleDotDashed} />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[#f6b73c]/20 bg-[#f6b73c]/[0.045] px-3.5 py-2.5 xl:max-w-[348px]">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#f6b73c]/12"><ShieldAlert className="h-3.5 w-3.5 text-[#f6b73c]" /></div>
                <p className="text-[10.5px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-200">Behavior shift detected.</span> Finance workstation traffic has left its learned peer group.</p>
                <button onClick={() => document.getElementById("anomaly-docket")?.scrollIntoView({ behavior: "smooth" })} className="font-mono text-[10px] text-[#f6b73c] hover:text-[#ffd67c]">Inspect</button>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.78fr)_minmax(290px,.82fr)]">
              <div className="instrument-panel signal-grid enter-stagger overflow-hidden rounded-xl">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
                  <div><div className="mb-1.5 flex items-center gap-2"><span className="panel-label">Communication graph</span><span className="measurement-id">MAP / 15M</span><span className="rounded border border-[#79dce0]/20 bg-[#79dce0]/[0.07] px-1.5 py-0.5 font-mono text-[9px] text-[#79dce0]">LIVE</span></div><h2 className="text-[14px] font-bold tracking-[-0.03em] text-slate-100">Host relationships over the last 15 minutes</h2></div>
                  <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-black/10 p-1"><button className="rounded bg-white/[0.08] px-2.5 py-1 font-mono text-[9px] text-slate-200">Hosts</button><button onClick={() => toast("Service overlay", { description: "Service-level grouping is available in the full explorer." })} className="rounded px-2.5 py-1 font-mono text-[9px] text-slate-500 hover:text-slate-300">Services</button></div>
                </div>
                <div className="relative px-2 pt-1"><NetworkGraph live={liveCapture} selectedHost={selectedHost} onHostSelect={selectHost} /><div className="absolute bottom-3 left-5 flex items-center gap-3 rounded bg-[#101319]/80 px-2.5 py-1.5 font-mono text-[9px] text-slate-500 backdrop-blur"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#79dce0]" />learned path</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#f6b73c]" />deviating path</span></div></div>
              </div>

              <aside id="anomaly-docket" className="instrument-panel enter-stagger overflow-hidden rounded-xl" style={{ animationDelay: "60ms" }}>
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><div className="mb-1.5 flex gap-2"><span className="panel-label">Anomaly docket</span><span className="measurement-id">Q / 017</span></div><h2 className="text-[14px] font-bold tracking-[-0.03em]">Three deviations need inspection</h2></div><span className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.08] text-[10px] font-semibold text-slate-400">17</span></div>
                <div className="max-h-[281px] overflow-y-auto scroll-thin">
                  {anomalies.map((item) => <button key={item.id} onClick={() => { setSelectedAnomalyId(item.id); setSelectedHost(item.source); }} className={`anomaly-bracket w-full border-b border-white/[0.06] px-5 py-3 text-left transition-colors ${selectedAnomalyId === item.id ? "bg-white/[0.055]" : "hover:bg-white/[0.025]"}`}><div className="flex gap-2.5"><SeverityDot severity={item.severity} /><div className="min-w-0 flex-1"><div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold text-slate-200">{item.title}</span><span className="font-mono text-[9px] text-slate-500">{item.time}</span></div><div className="flex items-center justify-between gap-3"><span className="truncate font-mono text-[9px] text-slate-500">{item.source}</span><span className="font-mono text-[9px] text-[#f6b73c]">{item.score.toFixed(2)}</span></div></div></div></button>)}
                </div>
                <div className="relative overflow-hidden border-t border-white/[0.07] bg-[#12171d] px-5 py-4">
                  <div className="absolute inset-0 bg-cover bg-right opacity-[0.11]" style={{ backgroundImage: "url('/manus-storage/packetmind-telemetry-hero_28b995f3.png')" }} />
                  <div className="relative"><div className="mb-2 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#f6b73c]" /><span className="panel-label text-[#d1a856]">PacketMind explanation</span></div><p className="mb-3 text-[10.5px] leading-relaxed text-slate-400">{selectedAnomaly.explanation}</p><button onClick={() => toast("Evidence trail opened", { description: "The selected event's flow evidence is ready for review." })} className="flex items-center gap-1.5 font-mono text-[10px] text-[#f6b73c] hover:text-[#ffd67c]">Open evidence trail <ArrowUpRight className="h-3 w-3" /></button></div>
                </div>
              </aside>
            </section>

            <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)_minmax(290px,.6fr)]">
              <div className="instrument-panel enter-stagger overflow-hidden rounded-xl px-5 py-4" style={{ animationDelay: "100ms" }}>
                <div className="mb-4 flex items-start justify-between"><div><div className="mb-1.5 flex gap-2"><span className="panel-label">Historical comparison</span><span className="measurement-id">HIST / 30D</span></div><h2 className="text-[14px] font-bold tracking-[-0.03em]">Traffic is 19% above the learned shape</h2></div><div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-[#79dce0]" />observed <span className="ml-2 h-px w-4 bg-slate-500" />baseline</div></div>
                <div className="h-[184px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trafficTrend} margin={{ top: 8, right: 5, left: -22, bottom: 0 }}><defs><linearGradient id="traffic-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#79DCE0" stopOpacity={0.28} /><stop offset="100%" stopColor="#79DCE0" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 9, fontFamily: "IBM Plex Mono" }} dy={5} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 9, fontFamily: "IBM Plex Mono" }} tickFormatter={(v) => `${v}G`} /><Tooltip contentStyle={{ background: "#151a20", border: "1px solid rgba(148,163,184,.2)", borderRadius: "6px", fontSize: "10px", fontFamily: "IBM Plex Mono" }} labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#cbd5e1" }} formatter={(value: number) => [`${value} GB`, "Traffic"]} /><Area type="monotone" dataKey="baseline" stroke="#596673" strokeDasharray="4 5" fill="none" strokeWidth={1.25} /><Area type="monotone" dataKey="traffic" stroke="#79DCE0" fill="url(#traffic-gradient)" strokeWidth={1.75} /></AreaChart></ResponsiveContainer></div>
              </div>

              <div className="instrument-panel enter-stagger overflow-hidden rounded-xl p-0" style={{ animationDelay: "140ms" }}>
                <div className="flex items-start justify-between px-5 pb-3 pt-4"><div><div className="mb-1.5 flex gap-2"><span className="panel-label">Traffic archetypes</span><span className="measurement-id">K / 04</span></div><h2 className="text-[14px] font-bold tracking-[-0.03em]">One cluster breaks the baseline</h2></div><Boxes className="h-4 w-4 text-slate-500" /></div>
                <div className="flex gap-3 px-4 pb-4"><div className="relative h-[130px] w-[132px] shrink-0 overflow-hidden rounded-lg border border-white/[0.06]"><img src="/manus-storage/packetmind-cluster-art_7e4bf6a3.png" alt="Abstract traffic cluster visualization" className="h-full w-full object-cover opacity-75" /><div className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-1 font-mono text-[8px] text-slate-300">K=4 / stable</div></div><div className="min-w-0 flex-1 space-y-3 pt-1">{trafficClusters.map((cluster) => <div key={cluster.name}><div className="mb-1 flex justify-between gap-2 font-mono text-[9px]"><span className="truncate text-slate-400">{cluster.name}</span><span className="text-slate-300">{cluster.amount}</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: cluster.amount, backgroundColor: cluster.color }} /></div></div>)}</div></div>
              </div>

              <div className="instrument-panel enter-stagger relative overflow-hidden rounded-xl p-5" style={{ animationDelay: "180ms" }}>
                <div className="absolute inset-0 bg-cover bg-right opacity-[0.16]" style={{ backgroundImage: "url('/manus-storage/packetmind-sensor-banner_50ac63b2.png')" }} />
                <div className="relative flex h-full min-h-[178px] flex-col"><div className="mb-1.5 flex gap-2"><span className="panel-label">Sensor array</span><span className="measurement-id">S / 03</span></div><div className="mb-4 flex items-start justify-between"><h2 className="text-[14px] font-bold tracking-[-0.03em]">Three collectors reporting</h2><div className="flex items-center gap-1.5 font-mono text-[9px] text-[#79dce0]"><span className="h-1.5 w-1.5 rounded-full bg-[#79dce0]" />HEALTHY</div></div><div className="mt-auto flex items-end justify-between"><div className="font-mono text-[10px] leading-relaxed text-slate-400"><span className="text-slate-200">eBPF</span> / 4.7M flows<br />last beat <span className="text-slate-200">12s ago</span></div><button onClick={() => toast("Collector panel", { description: "Sensor diagnostics are available in the full system." })} className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.1] bg-black/15 text-slate-300 transition-colors hover:bg-white/[0.08]"><SlidersHorizontal className="h-3.5 w-3.5" /></button></div></div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
              <div className="instrument-panel enter-stagger overflow-hidden rounded-xl" style={{ animationDelay: "220ms" }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4"><div><div className="mb-1.5 flex gap-2"><span className="panel-label">Latest detections</span><span className="measurement-id">EV / 17</span></div><h2 className="text-[14px] font-bold tracking-[-0.03em]">Evidence ledger for active deviations</h2></div><button onClick={() => toast("All detections", { description: "A full detection table would open here." })} className="font-mono text-[10px] text-slate-500 hover:text-[#79dce0]">View all 17 <ArrowUpRight className="ml-1 inline h-3 w-3" /></button></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[630px] text-left"><thead className="border-b border-white/[0.05]"><tr className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600"><th className="px-5 py-3 font-medium">Detection</th><th className="px-3 py-3 font-medium">Path</th><th className="px-3 py-3 font-medium">Evidence</th><th className="px-5 py-3 text-right font-medium">Score</th></tr></thead><tbody>{anomalies.map((item) => <tr key={item.id} onClick={() => { setSelectedAnomalyId(item.id); setSelectedHost(item.source); }} className={`cursor-pointer border-b border-white/[0.045] text-[10.5px] transition-colors last:border-0 ${selectedAnomalyId === item.id ? "bg-white/[0.04]" : "hover:bg-white/[0.025]"}`}><td className="px-5 py-3.5"><div className="mb-0.5 flex items-center gap-2"><SeverityDot severity={item.severity} /><span className="font-semibold text-slate-300">{item.title}</span></div><span className="font-mono text-[9px] text-slate-600">{item.id} · {item.time}</span></td><td className="px-3 py-3.5 font-mono text-[9px] text-slate-500"><span className="text-slate-400">{item.source}</span><br />{item.target}</td><td className="px-3 py-3.5"><span className="rounded bg-white/[0.045] px-1.5 py-1 font-mono text-[8.5px] text-slate-500">{item.evidence[0]}</span></td><td className="px-5 py-3.5 text-right"><span className={`font-mono text-[11px] ${item.severity === "critical" ? "text-[#f16f62]" : item.severity === "elevated" ? "text-[#f6b73c]" : "text-[#79dce0]"}`}>{item.score.toFixed(2)}</span></td></tr>)}</tbody></table></div>
              </div>

              <div className="instrument-panel enter-stagger relative overflow-hidden rounded-xl p-5" style={{ animationDelay: "260ms" }}>
                <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#f6b73c]/[0.055] blur-3xl" />
                <div className="relative"><div className="mb-1.5 flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-[#f6b73c]" /><span className="panel-label">Replay lab</span><span className="measurement-id">P / 05M</span></div><h2 className="mb-2 text-[14px] font-bold tracking-[-0.03em]">Test the detector against a PCAP</h2><p className="mb-4 max-w-[330px] text-[10.5px] leading-relaxed text-slate-500">Run a five-minute replay of a sandbox capture and compare surfaced outliers against the established baseline.</p>
                  {replay > 0 ? <div className="mb-4"><div className="mb-2 flex justify-between font-mono text-[9px] text-slate-400"><span>{replay === 100 ? "ANALYSIS COMPLETE" : "REPLAYING SAMPLE"}</span><span className="text-[#f6b73c]">{replay}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#f6b73c] transition-[width] duration-200" style={{ width: `${replay}%` }} /></div></div> : <div className="mb-4 flex items-center gap-2 font-mono text-[9px] text-slate-500"><Database className="h-3 w-3" />malware-lab-05m.pcap · 384 MB</div>}
                  <div className="flex items-center gap-2"><button disabled={replay > 0} onClick={() => setReplay(8)} className="flex items-center gap-2 rounded-md bg-[#f6b73c] px-3 py-2 text-[10px] font-bold text-[#201705] transition-colors hover:bg-[#ffd16a] disabled:cursor-not-allowed disabled:opacity-60"><Play className="h-3 w-3 fill-current" />{replay > 0 ? "Analyzing" : "Replay sample"}</button><button onClick={() => toast("PCAP import", { description: "File upload is represented in this prototype." })} className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.09] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"><Upload className="h-3.5 w-3.5" /></button><span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-slate-500"><Clock3 className="h-3 w-3" />5:00 sample</span></div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {searchOpen && <div role="dialog" aria-modal="true" aria-label="Search traffic" className="fixed inset-0 z-50 grid place-items-start bg-black/60 px-4 pt-24 backdrop-blur-sm" onClick={() => setSearchOpen(false)}><div className="w-full max-w-xl overflow-hidden rounded-xl border border-white/[0.12] bg-[#171c23] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3"><Search className="h-4 w-4 text-[#79dce0]" /><input autoFocus placeholder="Find a host, service, port, or anomaly…" className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-200 outline-none placeholder:text-slate-600" /><button onClick={() => setSearchOpen(false)} className="rounded border border-white/[0.1] px-1.5 py-0.5 font-mono text-[9px] text-slate-500"><X className="h-3 w-3" /></button></div><div className="p-3"><div className="mb-2 panel-label text-[9px]">Suggested hosts</div>{["10.14.8.23 · FIN-WS-023", "10.14.22.61 · DEV-WS-061", "185.199.110.153 · EXT-8443"].map((host) => <button key={host} onClick={() => { selectHost(host.split(" · ")[0]); setSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[11px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"><Command className="h-3.5 w-3.5 text-slate-600" />{host}</button>)}</div></div></div>}
    </div>
  );
}
