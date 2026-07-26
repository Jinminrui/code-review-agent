import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "review-contracts",
      include: ["packages/review-contracts/src/**/*.test.ts"],
      environment: "node"
    }
  },
  {
    test: {
      name: "review-backend",
      include: ["packages/review-backend/tests/**/*.test.ts"],
      environment: "node"
    }
  },
  {
    test: {
      name: "review-app",
      include: ["packages/review-app/tests/**/*.test.ts?(x)"],
      environment: "jsdom",
      setupFiles: ["./packages/review-app/src/test/setup.ts"]
    }
  },
  {
    test: {
      name: "review-shell",
      include: ["apps/review-shell/tests/**/*.test.ts"],
      environment: "node"
    }
  }
]);
