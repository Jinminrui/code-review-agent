import { z } from "zod";
export declare const createReviewSessionRequestSchema: z.ZodObject<{
    repositoryPath: z.ZodString;
    baseRef: z.ZodString;
    targetRef: z.ZodString;
    providerProfileId: z.ZodString;
    contextBudgetTokens: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
    contextBudgetTokens: number;
}, {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
    contextBudgetTokens?: number | undefined;
}>;
export declare const reviewSessionEventPayloadSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"session-started">;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session-started";
    sessionId: string;
}, {
    type: "session-started";
    sessionId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"unit-completed">;
    sessionId: z.ZodString;
    unitId: z.ZodString;
    findingsCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "unit-completed";
    sessionId: string;
    unitId: string;
    findingsCount: number;
}, {
    type: "unit-completed";
    sessionId: string;
    unitId: string;
    findingsCount: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session-finished">;
    sessionId: z.ZodString;
    totalFindings: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "session-finished";
    sessionId: string;
    totalFindings: number;
}, {
    type: "session-finished";
    sessionId: string;
    totalFindings: number;
}>]>;
export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
