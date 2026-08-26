import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest, added for THIS feature because the activity phases name their tests as
// the guard on standing rules 8 and 10 — and the repo had no test runner at all
// (no vitest, no jest, no test script, zero test files). Without a runner those
// tests would be documentation that never executes.
//
// DELIBERATELY MINIMAL. Node environment only: everything under test is pure
// logic (event model, alert resolution, read-state overlay). No jsdom, no
// testing-library, no setup file — a component-testing stack is a separate
// decision and nothing in these phases needs one.
//
// `next build` and `eslint` are untouched by this; the config is additive.
export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json, so test files import
    // exactly the way source files do.
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
