#!/usr/bin/env node
// Regenerate questions/manifest.json from the prompt files on disk.
//
// The manifest pins prompt text, repo, fixture branch, tsconfig, and the
// question SHA-256. It does not carry answer keys or scoring rules.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const qDir = path.join(here, "questions");

const REPOS = {
  excalidraw: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  vscode: { tsconfig: "src/tsconfig.json", fixtureBranch: "ttsc" },
  nestjs: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  vue: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  zod: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  typeorm: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  rxjs: { tsconfig: "tsconfig.graph.json", fixtureBranch: "ttsc" },
  "shopping-backend": { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
};

const has = (rel) => fs.existsSync(path.join(qDir, rel));
const sha = (rel) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(qDir, rel)))
    .digest("hex");

const prompt = (repo, family, file, meta) => ({
  id: `${repo}-${family}-v1`,
  repo,
  family,
  file,
  ...(meta.fixtureBranch ? { fixtureBranch: meta.fixtureBranch } : {}),
  tsconfig: meta.tsconfig,
  questionSha256: sha(file),
});

const prompts = [];
for (const [repo, meta] of Object.entries(REPOS)) {
  const dedicated = `${repo}.md`;
  if (has(dedicated)) prompts.push(prompt(repo, "dedicated", dedicated, meta));
  else console.warn(`warning: ${repo} has no ${dedicated}; skipped`);

  prompts.push(prompt(repo, "common", "common.md", meta));
}

const manifest = { schemaVersion: 1, prompts };
fs.writeFileSync(
  path.join(qDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`manifest.json: ${prompts.length} prompts`);
for (const item of prompts)
  console.log(
    `  ${item.id.padEnd(34)} ${item.family.padEnd(10)} ${item.file}`,
  );
