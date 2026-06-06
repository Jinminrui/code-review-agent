import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/globals.css";
import { ensureReviewWorkbenchApi } from "./test/mock-review-workbench-api";

if (import.meta.env.MODE === "test" || import.meta.env.VITE_USE_MOCK_API === "true") {
  ensureReviewWorkbenchApi();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>
);
