import child_process from "node:child_process";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { assert, ttscPackageRoot } from "../../internal/ttscserver";

/**
 * Verifies ttscserver launcher respects `--tsgo=<path>` without resolving env.
 *
 * Locks the argument-shape regression where the launcher recognized only
 * `--tsgo <path>`. A Node-backed fake native host records its environment so
 * this test proves the launcher does not inject TTSC_TSGO_BINARY when the
 * inline flag is present.
 *
 * 1. Prepare an isolated cwd plus a fake tsgo path.
 * 2. Spawn the JS ttscserver launcher with TTSC_TSGO_BINARY unset.
 * 3. Pass `--tsgo=<binary>`.
 * 4. Assert the fake host saw no injected TTSC_TSGO_BINARY.
 */
export const test_ttscserver_launcher_respects_inline_tsgo_flag = () => {
  const root = ttscPackageRoot();
  const launcher = path.join(root, "lib", "launcher", "ttscserver.js");
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ttscserver-inline-tsgo-"));
  const record = path.join(cwd, "record.json");
  const fakeTsgo = path.join(cwd, "tsgo");
  fs.writeFileSync(fakeTsgo, "", "utf8");
  const fakeHostScript = [
    "const fs = require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({`,
    "  args: process.argv.slice(1),",
    "  tsgo: process.env.TTSC_TSGO_BINARY || '',",
    "}));",
  ].join("\n");
  const env = { ...process.env };
  env.TTSCSERVER_BINARY = process.execPath;
  delete env.TTSC_TSGO_BINARY;

  try {
    const result = child_process.spawnSync(
      process.execPath,
      [
        launcher,
        "-e",
        fakeHostScript,
        "--",
        "--stdio",
        "--cwd",
        cwd,
        `--tsgo=${fakeTsgo}`,
      ],
      {
        cwd,
        encoding: "utf8",
        env,
        input: "",
        maxBuffer: 1024 * 1024 * 16,
        windowsHide: true,
      },
    );
    if (result.error) throw result.error;
    assert.equal(
      result.status,
      0,
      `launcher should exit cleanly\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    const recorded = JSON.parse(fs.readFileSync(record, "utf8")) as {
      args: string[];
      tsgo: string;
    };
    assert.deepEqual(recorded.args, [
      "--stdio",
      "--cwd",
      cwd,
      `--tsgo=${fakeTsgo}`,
    ]);
    assert.equal(recorded.tsgo, "");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
};
