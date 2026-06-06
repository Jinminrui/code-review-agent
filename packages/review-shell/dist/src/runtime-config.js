export function getRendererUrl(env) {
    return env.REVIEW_RENDERER_URL ?? "http://127.0.0.1:5173";
}
export function getPreloadFilename() {
    return "preload.cjs";
}
