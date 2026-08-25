import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { createAnalysisRun, createCapture, getLatestBaseline, getNetworkDashboard, retryAnalysisRun } from "./db";
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
      return { captureId, analysisId, status: "queued" as const, baselineUsed: input.mode === "compare" };
    }),
    retry: protectedProcedure.input(z.object({ analysisId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const record = await retryAnalysisRun(input.analysisId, ctx.user.id);
      return { analysisId: record.run.id, status: "queued" as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
