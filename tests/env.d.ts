import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      VAULT_KEY_ENCRYPTION_KEY: string;
    }
  }
}

export {};
