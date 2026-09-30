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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual prepareCodexHome with an owned credential source and checks its entire directory population, auth bytes and required single-server configuration.
 * @evidence contracts/testing.md#independent-expectations Literal credential bytes and auth.json/config.toml names are authored expectations; the pinned browser specifier is checked alongside literal required=true and exactly one MCP table.
 * @evidence contracts/testing.md#distinguishing-cases Unrelated operator instructions and configuration contrast the isolated home containing only auth and generated browser configuration; this case runs regardless of operator login state.
 * @evidence contracts/testing.md#execution-ownership The original named scenario belongs to source units and calls authored filesystem preparation without a Codex process, global replacement or installation; its exact owned root is removed in finally.
 */
export const test_benchmark_runtime_isolates_the_codex_home = (): void => {
  const root: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "evidence-home-case-"),
  );
  try {
    const operatorHome = path.join(root, "operator");
    fs.mkdirSync(operatorHome);
    const credential = Buffer.from('{"credential":"owned-case"}\n', "utf8");
    fs.writeFileSync(path.join(operatorHome, "auth.json"), credential);
    fs.writeFileSync(path.join(operatorHome, "AGENTS.md"), "unrelated instructions");
    fs.writeFileSync(path.join(operatorHome, "config.toml"), "unrelated configuration");
    const home: string = EvidenceBenchmarkRuntime.prepareCodexHome(root, undefined, operatorHome);
    if (!fs.readFileSync(path.join(home, "auth.json")).equals(credential))
      throw new Error("The isolated home must copy the exact owned credential bytes.");
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
