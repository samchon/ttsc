import child_process from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import { assert, ttscPackageRoot } from "../../internal/ttscserver";

/**
 * Verifies ttscserver launcher respects `--tsgo=<path>` without resolving env.
 *
 * Locks the argument-shape regression where the launcher recognized only
 * `--tsgo <path>`. Inline flags are common in generated editor configs; if the
 * launcher misses this form, it tries to resolve @typescript/native-preview from
 * the wrong cwd before the native host sees the explicit binary.
 *
 * 1. Resolve the workspace tsgo binary from the ttsc package root.
 * 2. Spawn the JS ttscserver launcher from a temp cwd with TTSC_TSGO_BINARY unset.
 * 3. Pass `--tsgo=<binary>` and closed stdin.
 * 4. Assert the process exits cleanly.
 */
export const test_ttscserver_launcher_respects_inline_tsgo_flag = () => {
  const root = ttscPackageRoot();
  const launcher = path.join(root, "lib", "launcher", "ttscserver.js");
  const tsgo = resolveTsgo({ cwd: root }).binary;
  const env = { ...process.env };
  delete env.TTSC_TSGO_BINARY;

  const result = child_process.spawnSync(
    process.execPath,
    [launcher, "--stdio", "--cwd", os.tmpdir(), `--tsgo=${tsgo}`],
    {
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
};
