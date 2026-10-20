import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target || !["staging", "production"].includes(target)) {
  console.error("Usage: node scripts/validate-access-config.mjs <staging|production>");
  process.exitCode = 1;
} else {
  const configUrl = new URL("../wrangler.jsonc", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const environment = config.env?.[target];
  const vars = environment?.vars ?? {};
  const database = environment?.d1_databases?.find(
    (candidate) => candidate.binding === "DB",
  );
  const errors = [];

  if (vars.AUTH_MODE !== "access") {
    errors.push(`${target}.AUTH_MODE must be access`);
  }

  const teamDomain = String(vars.TEAM_DOMAIN ?? "").trim();
  try {
    const url = new URL(teamDomain);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.endsWith(".cloudflareaccess.com")
    ) {
      errors.push(`${target}.TEAM_DOMAIN must be a Cloudflare Access HTTPS origin`);
    }
  } catch {
    errors.push(`${target}.TEAM_DOMAIN is missing or invalid`);
  }

  const audience = String(vars.POLICY_AUD ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(audience)) {
    errors.push(`${target}.POLICY_AUD is missing or invalid`);
  }
  if (!database?.database_id) {
    errors.push(`${target}.DB database_id is missing`);
  }

  if (errors.length > 0) {
    console.error(`Cloudflare Access configuration for ${target} is incomplete:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Cloudflare Access configuration for ${target} is ready.`);
  }
}
