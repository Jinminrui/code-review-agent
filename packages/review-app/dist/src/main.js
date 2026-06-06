import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/globals.css";
import { ensureReviewWorkbenchApi } from "./test/mock-review-workbench-api";
if (import.meta.env.MODE === "test" || import.meta.env.VITE_USE_MOCK_API === "true") {
    ensureReviewWorkbenchApi();
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(AppProviders, { children: _jsx(AppRouter, {}) }) }));
