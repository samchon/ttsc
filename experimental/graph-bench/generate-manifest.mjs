#!/usr/bin/env node
// Regenerate questions/manifest.json from the per-repo prompt files on disk.
//
// Two prompt families per repo:
//   - dedicated: questions/<repo>/dedicated.md (+ .gold.json) — a codegraph-style
//     mechanism question specific to that project (verbatim codegraph wording for
//     the repos codegraph itself benchmarks).
//   - common: the one questions/common.md shared by every repo, graded against
//     the trivial questions/common.gold.json (token-focused, no symbol gate).
//
// It stamps each prompt's questionSha256 so grade.mjs/agent-ab can detect drift.
// Run after the per-repo authoring agents land their files.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const qDir = path.join(here, "questions");

// Per-repo build metadata. excalidraw runs upstream (codegraph's own repo, no
// @ttsc fixture); the rest use the samchon ttsc-branch fixture.
// Each fixture's tsconfig for the graph dump. rxjs ships only a graph-tuned
// `tsconfig.graph.json`; vscode's program root is `src/tsconfig.json`; the rest
// load from the root `tsconfig.json`.
const REPOS = {
  excalidraw: { tsconfig: "tsconfig.json" },
  vscode: { tsconfig: "src/tsconfig.json", fixtureBranch: "ttsc" },
  nestjs: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  vue: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  zod: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  typeorm: { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
  rxjs: { tsconfig: "tsconfig.graph.json", fixtureBranch: "ttsc" },
  "shopping-backend": { tsconfig: "tsconfig.json", fixtureBranch: "ttsc" },
};

const sha = (rel) =>
  crypto.createHash("sha256").update(fs.readFileSync(path.join(qDir, rel))).digest("hex");
const has = (rel) => fs.existsSync(path.join(qDir, rel));

const prompts = [];
for (const [repo, meta] of Object.entries(REPOS)) {
  const branch = meta.fixtureBranch ? { fixtureBranch: meta.fixtureBranch } : {};
  const dedFile = `${repo}/dedicated.md`;
  if (has(dedFile) && has(`${repo}/dedicated.gold.json`)) {
    prompts.push({
      id: `${repo}-dedicated-v1`,
      repo,
      family: "dedicated",
      file: dedFile,
      gold: `${repo}/dedicated.gold.json`,
      ...branch,
      tsconfig: meta.tsconfig,
      questionSha256: sha(dedFile),
    });
  } else {
    console.warn(`warning: ${repo} has no dedicated.md/.gold.json yet — skipped`);
  }
  prompts.push({
    id: `${repo}-common-v1`,
    repo,
    family: "common",
    file: "common.md",
    gold: "common.gold.json",
    ...branch,
    tsconfig: meta.tsconfig,
    questionSha256: sha("common.md"),
  });
}

// Keep the typeorm architecture-overview prompt as a bonus facet.
if (has("typeorm/overview.md")) {
  prompts.push({
    id: "typeorm-overview-v1",
    repo: "typeorm",
    family: "overview",
    file: "typeorm/overview.md",
    gold: "typeorm/overview.gold.json",
    fixtureBranch: "ttsc",
    tsconfig: "tsconfig.json",
    questionSha256: sha("typeorm/overview.md"),
  });
}

const manifest = { schemaVersion: 1, prompts };
fs.writeFileSync(
  path.join(qDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`manifest.json: ${prompts.length} prompts`);
for (const p of prompts) console.log(`  ${p.id.padEnd(34)} ${p.family.padEnd(10)} ${p.file}`);
