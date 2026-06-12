export function getRendererUrl(env: Record<string, string | undefined>) {
  return env.REVIEW_RENDERER_URL ?? "http://127.0.0.1:5173";
}

export function getPreloadFilename() {
  return "preload.cjs";
}
