import { createHash, randomBytes, randomUUID } from "node:crypto";

const email = process.argv[2]?.trim().toLowerCase();
const requestedDays = Number.parseInt(process.argv[3] ?? "14", 10);

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run invite -- tester@example.com [valid-days]");
  process.exitCode = 1;
} else if (!Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 90) {
  console.error("valid-days must be an integer between 1 and 90.");
  process.exitCode = 1;
} else {
  const code = randomBytes(24).toString("base64url");
  const codeHash = createHash("sha256").update(code, "utf8").digest("hex");
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + requestedDays * 86_400_000).toISOString();
  const sqlEmail = email.replaceAll("'", "''");

  console.log("Invite code (share once):");
  console.log(code);
  console.log("\nApply this SQL to the intended D1 environment:");
  console.log(
    `INSERT INTO invites (id, email, code_hash, expires_at, created_at) VALUES ('${id}', '${sqlEmail}', '${codeHash}', '${expiresAt}', '${createdAt}');`,
  );
}
