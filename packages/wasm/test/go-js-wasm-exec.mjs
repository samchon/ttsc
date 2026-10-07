import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Go's WASM argv/env reservation is only 8 KiB. Build and CI variables stay
// with native Go; the actual toolchain runner receives only runtime inputs.
// Its 8192 KiB V8 stack is the same setting as Go's go_js_wasm_exec script.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-wasm-tests-"));
try {
  // The guest uses POSIX absolute paths. On Windows, root-relative Node paths
  // resolve on the child's current drive, so give it the temporary drive too.
  const guest = process.platform === "win32"
    ? `/${path.relative(path.parse(temporary).root, temporary).replaceAll("\\", "/")}`
    : temporary;
  const configuredRoot = process.env.TTSC_WASM_TEST_ROOT;
  const result = spawnSync(process.execPath, [
    "--stack-size=8192", ...process.argv.slice(2),
  ], {
    cwd: configuredRoot ? process.cwd() : temporary,
    stdio: "inherit",
    env: {
      PATH: process.env.PATH ?? "",
      TMPDIR: configuredRoot
        ? process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp"
        : guest,
      TTSC_WASM_TEST_ROOT: configuredRoot || `${guest}/project`,
    },
  });
  if (result.error) console.error(result.error);
  if (result.signal) console.error(`WASM tests terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
