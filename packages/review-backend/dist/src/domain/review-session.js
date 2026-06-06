import { z } from "zod";
export const reviewSessionInputSchema = z.object({
    repositoryPath: z.string().min(1),
    baseRef: z.string().min(1),
    targetRef: z.string().min(1),
    providerProfileId: z.string().min(1),
    contextBudgetTokens: z.number().int().positive().default(12000)
});
export const reviewSessionEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("session-started"),
        sessionId: z.string()
    }),
    z.object({
        type: z.literal("unit-completed"),
        sessionId: z.string(),
        unitId: z.string(),
        findingsCount: z.number().int().nonnegative()
    }),
    z.object({
        type: z.literal("session-finished"),
        sessionId: z.string(),
        totalFindings: z.number().int().nonnegative()
    })
]);
