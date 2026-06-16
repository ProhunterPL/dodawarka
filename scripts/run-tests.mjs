import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const testFiles = [
  "validation.test.ts",
  "batch.test.ts",
  "template.test.ts",
  "channel-metadata.test.ts",
];

let exitCode = 0;

for (const testFile of testFiles) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", path.join(root, testFile)],
    {
      cwd: path.join(root, ".."),
      stdio: "inherit",
      env: process.env,
    },
  );

  if ((result.status ?? 1) !== 0) {
    exitCode = result.status ?? 1;
  }
}

process.exit(exitCode);
