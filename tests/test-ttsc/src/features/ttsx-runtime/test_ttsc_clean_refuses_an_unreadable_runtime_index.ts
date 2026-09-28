import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies clean does not take an unreadable run index as an empty one.
 *
 * A failed listing proves nothing about the runs beneath it. Treating
 * `EACCES` as an absent index selected the entire runtime root for removal,
 * including any live run the process lacked permission to inspect.
 *
 * 1. Make the run index unreadable on a host that enforces that permission.
 * 2. Run the real `ttsc clean` command.
 * 3. Assert it fails without removing the runtime directory.
 */
export const test_ttsc_clean_refuses_an_unreadable_runtime_index = (): void => {
  if (process.platform === "win32") return;
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "unreadable-runs", private: true }),
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
    "src/main.ts": "export const value = 1;\n",
  });
  const runs = runtimeRunsDirectory(root);
  const runtime = path.dirname(runs);
  fs.mkdirSync(path.join(runs, "held"), { recursive: true });
  fs.chmodSync(runs, 0o000);
  try {
    try {
      fs.readdirSync(runs);
      return;
    } catch (error) {
      assert.ok(
        ["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? ""),
      );
    }
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root],
      { cwd: root },
    );
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(fs.existsSync(runtime), true);
  } finally {
    fs.chmodSync(runs, 0o755);
  }
};
