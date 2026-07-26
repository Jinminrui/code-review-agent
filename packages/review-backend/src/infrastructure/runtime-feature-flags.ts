export type ReviewRuntimeMode = "legacy" | "hybrid";

export type RuntimeFeatureFlags = {
  reviewRuntime: ReviewRuntimeMode;
};

export const DEFAULT_RUNTIME_FEATURE_FLAGS: RuntimeFeatureFlags = {
  reviewRuntime: "legacy"
};

export function resolveRuntimeFeatureFlags(
  value?: Partial<RuntimeFeatureFlags>
): RuntimeFeatureFlags {
  return {
    reviewRuntime: value?.reviewRuntime === "hybrid" ? "hybrid" : "legacy"
  };
}
