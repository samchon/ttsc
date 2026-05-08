import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { workspaceRoot } from "@ttsc/testing";

/**
 * Runs the Go test suite owned by `packages/ttsc`.
 *
 * The JavaScript test package keeps Go verification inside the same dynamic
 * test harness as the TypeScript feature packages. That makes missing feature
 * discovery visible and keeps the root `test:features` command workspace-driven
 * instead of special-casing this package as a standalone runner.
 *
 * 1. Resolve the workspace `packages/ttsc` directory.
 * 2. Prefer the local Go SDK path when the developer machine has one.
 * 3. Execute `go test ./...` and fail on either spawn or test failure.
 */
export const test_ttsc_go_package_tests_pass = (): void => {
  const ttscRoot = path.join(workspaceRoot, "packages", "ttsc");
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  const result = child_process.spawnSync("go", ["test", "./..."], {
    cwd: ttscRoot,
    env: {
      ...process.env,
      PATH: fs.existsSync(localGo)
        ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
        : process.env.PATH,
    },
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`go test ./... failed with status ${result.status ?? 1}`);
  }
};
