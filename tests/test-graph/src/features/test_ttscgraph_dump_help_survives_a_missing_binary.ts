import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { assert, resolveGraphLauncher } from "../internal/ttsgraph";

/**
 * Verifies `dump --help` still answers when the native binary cannot be found.
 *
 * `dump` forwards every flag to `ttscgraph`, which owns the contract and
 * answers `--help` itself. When no platform package is installed the launcher
 * used to fail resolution first, so the one command that could tell a caller
 * what to install was reachable only by callers who had already installed it.
 * The fallback must stay a fallback: an ordinary `dump` with no binary is still
 * an error, and a resolvable binary must keep owning help.
 *
 * 1. Point `TTSC_GRAPH_BINARY` at a path that does not exist.
 * 2. Assert every help spelling exits 0 with usage naming the native authority.
 * 3. Assert an ordinary `dump` still fails, and that a resolvable binary receives
 *    `--help` instead of the launcher answering for it.
 */
export const test_ttscgraph_dump_help_survives_a_missing_binary = () => {
  const root = TestProject.tmpdir("ttscgraph-dump-help-");
  const absent = path.join(root, "does-not-exist", "ttscgraph");

  const run = (args: string[], binary: string, marker?: string) =>
    TestProject.spawn(process.execPath, [resolveGraphLauncher(), ...args], {
      cwd: root,
      env: {
        TTSC_GRAPH_BINARY: binary,
        ...(marker === undefined ? {} : { TTSCGRAPH_MARKER: marker }),
      },
      timeout: 30_000,
    });

  for (const flag of ["--help", "-help", "-h"]) {
    const result = run(["dump", flag], absent);
    assert.equal(
      result.status,
      0,
      `dump ${flag} without a binary exits successfully\nstderr: ${result.stderr}`,
    );
    assert.match(
      result.stdout ?? "",
      /^Usage: ttsc-graph dump/m,
      `dump ${flag} writes usage`,
    );
    // The summary is not the contract. A reader has to be told where the real
    // list lives, or a drifted copy silently becomes the answer.
    assert.match(
      result.stdout ?? "",
      /ttscgraph/,
      `dump ${flag} names the native authority`,
    );
  }

  // The fallback is scoped to help. Resolution failure is still an error for
  // the command that actually needs the binary.
  const ordinary = run(["dump", "--pretty"], absent);
  assert.notEqual(
    ordinary.status,
    0,
    `an ordinary dump without a binary still fails\nstdout: ${ordinary.stdout}`,
  );
  assert.match(
    ordinary.stderr ?? "",
    /could not resolve the ttscgraph binary/,
    "the resolution error is preserved",
  );

  // A resolvable binary keeps owning help, so the two texts cannot diverge for
  // anyone who has it installed.
  const sentinel = TestProject.tmpdir("ttscgraph-dump-help-sentinel-");
  const marker = path.join(sentinel, "native-marker.json");
  const binary = path.join(sentinel, "ttscgraph");
  fs.writeFileSync(
    binary,
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "fs.writeFileSync(process.env.TTSCGRAPH_MARKER, JSON.stringify(process.argv.slice(2)));",
      "process.exit(23);",
      "",
    ].join("\n"),
  );
  fs.chmodSync(binary, 0o755);
  // Windows cannot mark the sentinel executable, so the forwarding half only
  // runs where spawning it can actually succeed.
  if (process.platform !== "win32") {
    const forwarded = run(["dump", "--help"], binary, marker);
    assert.equal(
      forwarded.status,
      23,
      `a resolvable binary answers dump --help itself\nstdout: ${forwarded.stdout}`,
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(marker, "utf8")) as string[],
      ["dump", "--help"],
      "the help flag reaches the native binary unchanged",
    );
  }
};
