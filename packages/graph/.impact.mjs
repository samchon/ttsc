// What a tour change actually moves, before a single token is spent.
//
// Every cell of the grid, both prompt families, one offline MCP call each. It
// prints the seeds and the payload size, so a change can be compared against a
// baseline snapshot taken the same way: whatever differs here is what must be
// re-measured, and whatever does not cannot have moved.
//
//   node impact.mjs before.json     # snapshot the current build
//   node impact.mjs after.json before.json   # compare a new build against it
import fs from "node:fs";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const QUESTIONS =
  "D:/github/samchon/ttsc/experimental/benchmark/graph/questions";
const TSCONFIG = {
  zod: "tsconfig.graph.json",
  rxjs: "tsconfig.graph.json",
  vue: "tsconfig.graph.json",
  nestjs: "tsconfig.graph.json",
  "shopping-backend": "tsconfig.graph.json",
  excalidraw: "tsconfig.json",
  typeorm: "tsconfig.json",
  vscode: "src/tsconfig.json",
};
const REPOS = Object.keys(TSCONFIG);
const manifest = JSON.parse(
  fs.readFileSync(path.join(QUESTIONS, "manifest.json"), "utf8"),
);

const outFile = process.argv[2];
const baseFile = process.argv[3];

async function tourOf(repo, family) {
  const entry = manifest.prompts.find(
    (p) => p.repo === repo && p.family === family,
  );
  if (!entry) return null;
  const question = fs
    .readFileSync(path.join(QUESTIONS, entry.file), "utf8")
    .trim();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "D:/github/samchon/ttsc/packages/graph/lib/bin.js",
      "--cwd",
      `D:/github/samchon/graph-benchmark-work/${repo}@graph`,
      "--tsconfig",
      TSCONFIG[repo],
    ],
    env: {
      ...process.env,
      TTSC_GRAPH_BINARY:
        "C:/Users/samch/AppData/Local/Temp/ttscgraph-check.exe",
    },
  });
  const client = new Client({ name: "impact", version: "1.0.0" });
  await client.connect(transport);
  try {
    const res = await client.callTool({
      name: "inspect_typescript_graph",
      arguments: {
        question,
        draft: { reason: "orientation", type: "tour" },
        review: "tour",
        request: { type: "tour", query: question },
      },
    }, undefined, { timeout: 900_000 });
    const out = res.structuredContent ?? JSON.parse(res.content[0].text);
    return {
      seeds: (out.result.entrypoints ?? []).map((node) => node.name),
      flows: (out.result.primaryFlow ?? []).map((flow) => flow.start?.name),
      chars: JSON.stringify(out).length,
      payload: JSON.stringify(out.result),
    };
  } finally {
    await client.close();
  }
}

const snapshot = {};
for (const repo of REPOS) {
  for (const family of ["common", "dedicated"]) {
    const tour = await tourOf(repo, family);
    if (tour !== null) snapshot[`${repo}/${family}`] = tour;
  }
}

if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
  console.log(`wrote ${outFile} (${Object.keys(snapshot).length} cells)`);
}

if (baseFile) {
  const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
  const moved = [];
  for (const [cell, tour] of Object.entries(snapshot)) {
    const before = base[cell];
    if (before === undefined) continue;
    const identical = before.payload === tour.payload;
    if (identical) continue;
    moved.push({
      cell,
      seedsBefore: before.seeds.join(", "),
      seedsAfter: tour.seeds.join(", "),
      chars: `${before.chars} -> ${tour.chars}`,
      seedsChanged: before.seeds.join() !== tour.seeds.join(),
    });
  }
  console.log(
    `\n${moved.length} of ${Object.keys(snapshot).length} cells move; ${Object.keys(snapshot).length - moved.length} are byte-identical and cannot have changed.\n`,
  );
  for (const item of moved) {
    console.log(`=== ${item.cell}  (${item.chars} chars)`);
    if (item.seedsChanged) {
      console.log(`   before: ${item.seedsBefore}`);
      console.log(`   after : ${item.seedsAfter}`);
    } else {
      console.log("   seeds unchanged; payload differs below the seeds");
    }
  }
}
