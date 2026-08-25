# PacketMind Design Directions

## 1. The Signal Ledger
**Very Brief Intro:** A sober scientific-instrument dashboard that treats network behavior as a living field of measured signals. Warm amber alerts sit against graphite surfaces and cool cyan telemetry, creating a composed, trustworthy analytical environment.

**Probability:** 0.07

## 2. Topographic Observatory
**Very Brief Intro:** A light, paper-like operations studio where traffic is mapped as layered contour diagrams and observation cards. It feels research-led and editorial rather than conventionally technical.

**Probability:** 0.03

## 3. Incident Fieldbook
**Very Brief Intro:** A high-contrast dossier interface inspired by forensic field notes, with off-white paper, black ink, and tactical red annotations. It makes anomaly investigation feel deliberate and evidence-based.

**Probability:** 0.09

---

# Chosen Direction: The Signal Ledger

## Design Movement

The interface draws from **scientific instrument panels, Swiss editorial information design, and contemporary observability tooling**. It rejects theatrical “cybersecurity” motifs in favour of structured, legible signals that make complex traffic behavior feel inspectable.

## Core Principles

1. **Evidence over spectacle:** Every visual element should explain traffic state, risk, or context.
2. **Asymmetric situational awareness:** A persistent observatory rail anchors the system while the main canvas adapts to the current investigation.
3. **Calm baseline, precise exceptions:** Graphite surfaces and quiet grays establish normality; amber is reserved for meaningful deviations and cyan for live telemetry.
4. **Tactile measurement language:** Hairline rules, numerical rulers, coordinate marks, and subtle grain make the product feel like a trustworthy instrument.

## Color Philosophy

Graphite black and mineral gray make long analytical sessions comfortable while allowing visual hierarchy to emerge from restrained tonal shifts rather than container overload. **Signal Amber (#F6B73C)** is the ownable signature color: it communicates an anomaly that deserves attention without using alarm-red indiscriminately. Pale **Telemetry Cyan (#79DCE0)** is limited to live flow, baseline measurements, and successful sensor state. A muted coral is used only for critical risk severity.

## Layout Paradigm

The dashboard is organized as an **observatory rail plus investigation field** rather than a centralized card grid. The left rail is a fixed navigation and environment index. The main area uses a large communication map as a working surface, with a vertical anomaly docket and narrow metadata column creating a purposeful, three-part analytical composition. On smaller screens, the docket collapses below the map rather than shrinking incomprehensibly.

## Signature Elements

1. **Signal rulers:** Tiny mono labels and tick marks appear at panel edges to frame measured content.
2. **Packet paths:** Fine cyan or amber flows run between host nodes and animate subtly when live capture is enabled.
3. **Anomaly brackets:** Amber left-edge brackets and small numerical IDs identify anomalous events consistently across the product.

## Interaction Philosophy

Interactions should feel like operating an instrument. Controls use direct, specific labels such as “Replay sample” and “Inspect host,” while clicking a node changes the selected investigation context and clicking an anomaly expands its evidence. The live-capture switch changes telemetry state rather than merely decorating the interface. Information-dense views privilege visibility and keyboard reachability over ornamental movement.

## Animation

Packet flows drift continuously at a low visual priority while capture is live; animations are limited to opacity and transforms and respect reduced-motion preferences. Anomaly rows and charts enter with brief 180–240ms staggered fades; confirmation controls use a 140ms press response. Drawer-like evidence panels slide from the edge with a sharp ease-out curve. No looping glow, pulsing alarm, or full-screen motion is used.

## Typography System

**Manrope** is used for primary interface copy because its round counters make dense operational UI friendlier without becoming informal. **IBM Plex Mono** is used for hostnames, ports, numerical telemetry, timestamps, and graph labels. Page titles use Manrope at strong weight with tight tracking; section labels are mono uppercase with wide tracking; explanatory text remains short and clearly subordinate.

## Brand Essence

**PacketMind turns normal network behavior into an inspectable baseline so security teams can recognize the traffic that does not belong.**

Personality: **measured, lucid, forensic.**

## Brand Voice

Headlines are concise and evidence-led; CTAs describe the analytical action, while microcopy names the current signal state without broad promises.

Example lines:

> “Normal traffic has a shape. This connection breaks it.”

> “Replay a sample to test the detector against known traffic.”

## Wordmark & Logo

The mark is a compact **packet pulse**: three offset route segments converge on a single analytical node, rendered in amber with a single cyan path. The wordmark pairs the mark with a tight Manrope logotype and treats the final “M” as a subtle mirrored path.

## Signature Brand Color

**Signal Amber — #F6B73C**

## Style Decisions

- Every major panel includes an explicit measurement primitive: a coordinate label, baseline marker, anomaly ID, evidence bracket, or ruler tick.
- The PacketMind wordmark always pairs the packet-pulse mark with a customized Manrope lockup and a visibly treated mirrored-path “M”.
- Signal Amber is reserved for anomalies, deviation paths, risk scores, and the primary analytical action. Telemetry Cyan is reserved for live flow, learned paths, baseline state, and healthy sensors.
