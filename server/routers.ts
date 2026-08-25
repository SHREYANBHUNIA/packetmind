import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { createHeartbeatJob } from "./_core/heartbeat";
import { getSessionCookieOptions } from "./_core/cookies";
import { createAnalysisRun, createCapture, getLatestBaseline, getNetworkDashboard, retryAnalysisRun, setProcessorHeartbeat } from "./db";
import { processStoredPcapAnalysis } from "./pcapJobProcessor";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  network: router({
    dashboard: protectedProcedure.query(({ ctx }) => getNetworkDashboard(ctx.user.id)),
    uploadAndAnalyze: protectedProcedure.input(z.object({
      filename: z.string().min(1).max(255),
      networkLabel: z.string().min(2).max(120),
      mode: z.enum(["learn", "compare"]),
      base64Content: z.string().min(16),
    })).mutation(async ({ ctx, input }) => {
      if (!/\.(pcap|cap)$/i.test(input.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "PacketMind accepts classic .pcap or .cap files in this MVP." });
      const fileBytes = Buffer.from(input.base64Content, "base64");
      if (fileBytes.length > 20 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Use a capture smaller than 20 MB for in-browser upload analysis." });
      if (fileBytes.length < 24) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file is not large enough to contain a PCAP header." });
      const stored = await storagePut(`packetmind/${ctx.user.id}/captures/${input.filename}`, fileBytes, "application/vnd.tcpdump.pcap");
      const captureId = await createCapture({ userId: ctx.user.id, filename: input.filename, networkLabel: input.networkLabel, storageKey: stored.key, storageUrl: stored.url, byteSize: fileBytes.length, mode: input.mode });
      const learned = input.mode === "compare" ? await getLatestBaseline(ctx.user.id) : undefined;
      const analysisId = await createAnalysisRun(captureId, ctx.user.id, learned?.capture.id);
      const outcome = await processStoredPcapAnalysis({ captureId, analysisId, userId: ctx.user.id });
      if (outcome.failed) throw new TRPCError({ code: "BAD_REQUEST", message: outcome.message });
      return { captureId, analysisId, status: "ready" as const, baselineUsed: input.mode === "compare", anomalies: outcome.anomalies, summary: outcome.summary };
    }),
    retry: protectedProcedure.input(z.object({ analysisId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const record = await retryAnalysisRun(input.analysisId, ctx.user.id);
      const outcome = await processStoredPcapAnalysis({ captureId: record.capture.id, analysisId: record.run.id, userId: ctx.user.id });
      if (outcome.failed) throw new TRPCError({ code: "BAD_REQUEST", message: outcome.message });
      return { analysisId: record.run.id, status: "ready" as const, anomalies: outcome.anomalies, summary: outcome.summary };
    }),
    provisionProcessor: protectedProcedure.mutation(async ({ ctx }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in again before activating the PacketMind processor." });
      const job = await createHeartbeatJob({
        name: `packetmind-pcap-processor-${ctx.user.id}`,
        cron: "0 * * * * *",
        path: "/api/scheduled/processPcapQueue",
        description: "Process one queued PacketMind PCAP analysis with durable progress updates",
      }, sessionToken);
      await setProcessorHeartbeat(job.taskUid);
      return job;
    }),
  }),
});

export type AppRouter = typeof appRouter;
