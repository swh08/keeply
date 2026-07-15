import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: { provider: "v8", reporter: ["text", "html"], include: ["src/lib/money/**/*.ts", "src/lib/dates/**/*.ts"] },
  },
});
