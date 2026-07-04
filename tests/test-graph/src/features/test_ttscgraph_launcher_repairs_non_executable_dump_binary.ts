import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { assert, resolveGraphLauncher } from "../internal/ttsgraph";

/**
 * Verifies graph launcher repairs a non-executable dump binary.
 *
 * Platform package tarballs can lose POSIX executable bits when they are packed
 * from a non-POSIX host. The launcher must recover before spawning ttscgraph so
 * installed @ttsc/graph users do not hit EACCES on the first dump.
 *
 * 1. Materialize a fake ttscgraph script with mode 0644.
 * 2. Run the @ttsc/graph dump pass-through against that binary.
 * 3. Assert the script executed and gained an executable bit.
 */
export const test_ttscgraph_launcher_repairs_non_executable_dump_binary =
  () => {
    if (process.platform === "win32") return;

    const root = TestProject.tmpdir("ttscgraph-chmod-");
    const binary = path.join(root, "ttscgraph");
    fs.writeFileSync(
      binary,
      [
        "#!/usr/bin/env node",
        'if (process.argv[2] !== "dump") process.exit(2);',
        'console.log("ttscgraph chmod repair ok");',
        "",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(binary, 0o644);

    const result = TestProject.spawn(
      process.execPath,
      [resolveGraphLauncher(), "dump"],
      {
        env: { TTSC_GRAPH_BINARY: binary },
      },
    );

    assert.equal(
      result.status,
      0,
      `graph dump should execute the repaired binary\nstderr: ${result.stderr}`,
    );
    assert.match(result.stdout, /ttscgraph chmod repair ok/);
    assert.notEqual(
      fs.statSync(binary).mode & 0o111,
      0,
      "launcher should set an executable bit before spawning",
    );
  };
