import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies both ttsx and `ttsc/register` remove, while preparing, a runtime
 * directory whose recorded owners are all gone.
 *
 * A run terminated outright never removes its runtime directory. Each run now
 * records its processes as the owners of its directory, and a later preparation
 * removes the directories whose owners are all provably gone
 * (samchon/ttsc#1579). Both entry points prepare through the same step, and
 * each is held to it here.
 *
 * 1. Plant a run directory whose only owner record names a process of this host
 *    that has ended.
 * 2. Run an entry through ttsx, and assert the planted directory is gone.
 * 3. Plant another, run the entry through `node --import ttsc/register`, and
 *    assert that directory is gone too.
 */
export const test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone =
  (): void => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "gone-owner", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          strict: true,
          target: "ES2022",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": 'const message: string = "ran";\nconsole.log(message);\n',
    });
    const runs = runtimeRunsDirectory(root);
    const env = isolatedCacheEnvironment(root);
    const plant = (name: string): string => {
      const directory = path.join(runs, name);
      const pid = endedProcessId();
      fs.mkdirSync(path.join(directory, "fs"), { recursive: true });
      fs.writeFileSync(
        path.join(directory, `owner-${pid}.json`),
        JSON.stringify({ hostname: os.hostname(), pid }),
        "utf8",
      );
      fs.writeFileSync(path.join(directory, "fs", "main.js"), "", "utf8");
      return directory;
    };

    const byTtsx = plant("ended-ttsx-run");
    const ttsx = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root, env },
    );
    assert.equal(ttsx.status, 0, ttsx.stderr);
    assert.equal(ttsx.stdout.trim(), "ran");
    assert.equal(
      fs.existsSync(byTtsx),
      false,
      "ttsx kept a run directory whose owners are gone",
    );

    const byRegister = plant("ended-register-run");
    const register = TestProject.spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages",
            "ttsc",
            "lib",
            "register.js",
          ),
        ).href,
        "src/main.ts",
      ],
      { cwd: root, env },
    );
    assert.equal(register.status, 0, register.stderr);
    assert.equal(register.stdout.trim(), "ran");
    assert.equal(
      fs.existsSync(byRegister),
      false,
      "ttsc/register kept a run directory whose owners are gone",
    );
  };

/** The id of a process of this host that ran and has ended. */
function endedProcessId(): number {
  for (;;) {
    const { error, pid } = child_process.spawnSync(process.execPath, [
      "-e",
      "",
    ]);
    if (error !== undefined || pid === undefined)
      throw error ?? new Error("the process started without an id");
    try {
      process.kill(pid, 0);
    } catch {
      return pid;
    }
  }
}
