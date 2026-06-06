import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rendererUrl = "http://127.0.0.1:5173";

function spawnCommand(command, args, extra = {}) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    ...extra
  });
}

async function waitForRenderer(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server is ready.
    }

    await delay(500);
  }

  throw new Error(`renderer dev server did not become ready: ${url}`);
}

const renderer = spawnCommand(
  "pnpm",
  ["--filter", "@app/review-app", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
  {
    env: {
      ...process.env,
      VITE_USE_MOCK_API: "false"
    }
  }
);

let electronProcess;

function shutdown(code = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill("SIGTERM");
  }

  if (!renderer.killed) {
    renderer.kill("SIGTERM");
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

renderer.on("exit", (code) => {
  if (!electronProcess) {
    process.exit(code ?? 1);
  }
});

try {
  await waitForRenderer(rendererUrl);

  const backendBuild = spawnCommand("pnpm", ["--filter", "@app/review-backend", "build"]);
  const shellBuild = spawnCommand("pnpm", ["--filter", "@app/review-shell", "build"]);

  await Promise.all([
    new Promise((resolveBuild, rejectBuild) => {
      backendBuild.on("exit", (code) => {
        if (code === 0) {
          resolveBuild(undefined);
          return;
        }

        rejectBuild(new Error(`review-backend build failed with code ${code ?? 1}`));
      });
    }),
    new Promise((resolveBuild, rejectBuild) => {
      shellBuild.on("exit", (code) => {
        if (code === 0) {
          resolveBuild(undefined);
          return;
        }

        rejectBuild(new Error(`review-shell build failed with code ${code ?? 1}`));
      });
    })
  ]);

  electronProcess = spawnCommand(
    "pnpm",
    ["exec", "electron", "packages/review-shell/dist/src/main.js"],
    {
      env: {
        ...process.env,
        REVIEW_RENDERER_URL: rendererUrl
      }
    }
  );

  electronProcess.on("exit", (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
