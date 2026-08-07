import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceBenchmarkRuntime } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkRuntime";

/**
 * Verifies a cell reads one generated Codex home and nothing from the
 * operator's.
 *
 * Without this the runner inherits `~/.codex`, so every measured thread reads
 * whatever `AGENTS.md`, hooks, personality, and MCP servers that machine
 * happens to carry. A cohort compared under those conditions is comparing the
 * arms plus an untracked per-machine table, and nothing in the retained record
 * would say so. The property is worth a case because it fails silently: a
 * leaked home produces a run that looks exactly like an isolated one.
 *
 * 1. Prepare a home under a run root.
 * 2. Read every file it contains.
 * 3. Assert it holds the copied credential and a configuration naming only the
 *    browser server, and that the server is required rather than optional.
 */
export const test_benchmark_runtime_isolates_the_codex_home = (): void => {
  const credential: string = path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(credential)) return; // Not logged in; the guard has its own case.

  const root: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "evidence-home-case-"),
  );
  try {
    const home: string = EvidenceBenchmarkRuntime.prepareCodexHome(root);
    const entries: string[] = fs.readdirSync(home).sort();
    if (entries.join(",") !== "auth.json,config.toml")
      throw new Error(
        `A cell's home must hold the credential and the generated configuration and nothing else, got: ${entries.join(", ")}`,
      );

    const configuration: string = fs.readFileSync(
      path.join(home, "config.toml"),
      "utf8",
    );
    for (const required of [
      "[mcp_servers.playwright]",
      "required = true",
      EvidenceBenchmarkRuntime.BROWSER_MCP_SPECIFIER,
    ])
      if (!configuration.includes(required))
        throw new Error(
          `The generated configuration must state ${required}:\n${configuration}`,
        );

    // Every server the cell can reach is one this file wrote. A second table
    // would be the operator's, which is the leak this exists to close.
    const servers: number = (configuration.match(/^\[mcp_servers\./gmu) ?? [])
      .length;
    if (servers !== 1)
      throw new Error(
        `A cell must see exactly one MCP server, got ${servers}:\n${configuration}`,
      );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
