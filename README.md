# PacketMind

**PacketMind** is an authenticated network-traffic analysis dashboard that learns the normal communication shape of a network from classic PCAP captures and highlights explainable deviations.

## What is included

| Capability | Implementation |
| --- | --- |
| PCAP ingestion | Authenticated `.pcap` / `.cap` upload with a 20 MB bounded-MVP limit. |
| Baseline learning | A first capture learns host, peer, port, protocol, and external-service metadata. |
| Comparison analysis | Later captures are compared to the most recent learned baseline. |
| Explainable anomalies | Unusual host-to-service relationships are stored with evidence and a plain-language explanation. |
| Analysis history | Queue, parse, learning, detection, completion, and failure stages are persisted. |
| Dashboard UX | Communication graph, anomaly docket, historical context, failure guidance, empty states, and retry controls. |

> PacketMind analyzes **packet metadata** from supported Ethernet or raw IPv4 classic PCAPs. The MVP does not retain application payload content in its relational analysis records.

## Stack

The repository uses React 19, TypeScript, Vite, Express, tRPC, Drizzle ORM, MySQL/TiDB-compatible persistence, and S3-compatible object storage through the bundled storage adapter.

## Run locally

Install dependencies, add your own environment values through your local secret manager, generate the database schema, and start the application.

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit generate
pnpm dev
```

Apply the generated migration to your database before using the dashboard. The production validation commands are:

```bash
pnpm check
pnpm test
pnpm build
pnpm start
```

## Deploying from GitHub

This is a **full-stack** Node application, not a static site. GitHub Pages alone cannot run the Express API, PCAP analysis, authenticated tRPC endpoints, or database connection. Connect the GitHub repository to a Node-compatible host such as Render, Railway, Fly.io, or a container service.

| Setting | Value |
| --- | --- |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Start command | `pnpm start` |
| Runtime | Node.js 22 or newer |
| Database | MySQL/TiDB-compatible instance, configured via `DATABASE_URL` |

Set every required production secret in the host's secret manager; do not commit `.env`. In particular, configure `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `VITE_OAUTH_PORTAL_URL`.

The project currently uses the Manus-integrated storage helper for uploaded captures. When deploying outside Manus, replace `server/storage.ts` with an adapter for your chosen object-store provider and set its credentials as server-side secrets. The analysis tables store object keys and metadata rather than PCAP bytes.

## Project layout

```text
client/     React dashboard
server/     Express, tRPC, PCAP analysis, persistence helpers
drizzle/    Database schema and migrations
shared/     Shared client/server types and constants
```

## Important MVP boundary

PacketMind completes bounded PCAP analysis during the authenticated upload request so the learning flow remains reliable on autoscaling hosts. For multi-gigabyte captures or continuous eBPF collection, move parsing to a dedicated job worker and use managed object storage plus a durable queue.
