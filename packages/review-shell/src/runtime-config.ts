export interface RendererUrlOptions {
  isPackaged?: boolean;
  appPath?: string;
}

export function getRendererUrl(
  env: Record<string, string | undefined>,
  options?: RendererUrlOptions
) {
  if (env.REVIEW_RENDERER_URL) {
    return env.REVIEW_RENDERER_URL;
  }

  if (options?.isPackaged && options.appPath) {
    return `file://${options.appPath}/renderer/index.html`;
  }

  return "http://127.0.0.1:5173";
}

export function getPreloadFilename() {
  return "preload.cjs";
}
