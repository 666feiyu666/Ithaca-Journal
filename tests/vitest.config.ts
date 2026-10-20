import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          VAULT_KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(projectDirectory, "migrations"),
          ),
        },
      },
    })),
  ],
  test: {
    include: ["tests/integration/**/*.spec.{js,ts}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
