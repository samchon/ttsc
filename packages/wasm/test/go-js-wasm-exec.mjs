import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

// Go's WASM argv/env reservation is only 8 KiB. Build and CI variables stay
// with native Go; the actual toolchain runner receives only runtime inputs.
// config/test-go.mjs sets the initial Node stack to Go's 8192 KiB setting.
// Load the unmodified toolchain runner here so Go signals the actual runtime,
// rather than a waiting parent whose child can retain Go's output pipes.
const runner = process.argv[2];
if (!runner) throw new Error("go-js-wasm-exec.mjs: missing toolchain runner");
const entry = path.resolve(runner);
const configuredRoot = process.env.TTSC_WASM_TEST_ROOT;
const temporary = configuredRoot
  ? undefined
  : fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-wasm-tests-"));
let guest;
if (temporary !== undefined) {
  // Ordinary runtime exit and runner failures release this process's directory.
  // A forcible OS termination can prevent JavaScript cleanup from running.
  process.on("exit", () => {
    // Windows keeps the current directory open until this process leaves it.
    process.chdir(path.dirname(temporary));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  // The guest uses POSIX absolute paths. On Windows, root-relative Node paths
  // resolve on the runtime's current drive, so give it the temporary drive too.
  guest = process.platform === "win32"
    ? `/${path.relative(path.parse(temporary).root, temporary).replaceAll("\\", "/")}`
    : temporary;
  process.chdir(temporary);
}
const runtimeEnvironment = {
  PATH: process.env.PATH ?? "",
  TMPDIR: configuredRoot
    ? process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp"
    : guest,
  TTSC_WASM_TEST_ROOT: configuredRoot || `${guest}/project`,
};
for (const name of Object.keys(process.env)) delete process.env[name];
Object.assign(process.env, runtimeEnvironment);
process.argv = [process.execPath, entry, ...process.argv.slice(3)];
createRequire(import.meta.url)(entry);
