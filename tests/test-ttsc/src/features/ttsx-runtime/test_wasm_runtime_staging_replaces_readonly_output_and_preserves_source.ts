import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Verifies repeated WASM runtime staging replaces read-only generated output
 * while retaining the selected Go SDK file's content and read-only
 * permissions.
 *
 * 1. Author a read-only SDK source and stale read-only generated runtime.
 * 2. Stage twice with changed source bytes and compare exact output bytes.
 * 3. Verify source protection, writable output and nonordinary-path refusal.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual staging function overwrites a read-only generated file twice, preserves the SDK source's bytes/permissions and rejects a directory destination without mutating it.
 * @evidence contracts/testing.md#independent-expectations Authored v1/v2 source bytes, explicit read-only/writable permission bits and a distinct authored directory determine the expected behavior.
 * @evidence contracts/testing.md#distinguishing-cases Read-only existing output, repeated changed-content staging and a nonordinary target distinguish idempotent replacement from permission failure or unsafe traversal; the actual workspace build validates assembly.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers the named export and calls the production staging operation over portable files; loading its build module reads Git metadata but starts no compiler, consumer installation or native host.
 */
export function test_wasm_runtime_staging_replaces_readonly_output_and_preserves_source(): void {
  const require = createRequire(import.meta.url);
  const { stageWasmExec } =
    require("../../../../../packages/wasm/build/build-wasm.cjs") as {
      stageWasmExec: (source: string, destination: string) => void;
    };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-wasm-stage-"));
  const source = path.join(root, "sdk.js");
  const destination = path.join(root, "runtime.js");
  try {
    fs.writeFileSync(source, "runtime-v1");
    fs.chmodSync(source, 0o444);
    fs.writeFileSync(destination, "stale-runtime");
    fs.chmodSync(destination, 0o444);
    stageWasmExec(source, destination);
    assert.equal(fs.readFileSync(destination, "utf8"), "runtime-v1");
    assert.equal(fs.readFileSync(source, "utf8"), "runtime-v1");
    assert.equal(fs.statSync(source).mode & 0o200, 0);
    assert.notEqual(fs.statSync(destination).mode & 0o200, 0);
    fs.chmodSync(source, 0o644);
    fs.writeFileSync(source, "runtime-v2");
    fs.chmodSync(source, 0o444);
    fs.chmodSync(destination, 0o444);
    stageWasmExec(source, destination);
    assert.equal(fs.readFileSync(destination, "utf8"), "runtime-v2");
    assert.equal(fs.readFileSync(source, "utf8"), "runtime-v2");
    assert.equal(fs.statSync(source).mode & 0o200, 0);
    const directory = path.join(root, "directory");
    fs.mkdirSync(directory);
    assert.throws(
      () => stageWasmExec(source, directory),
      /ordinary generated file/,
    );
    assert.equal(fs.statSync(directory).isDirectory(), true);
  } finally {
    if (fs.existsSync(source)) fs.chmodSync(source, 0o644);
    if (fs.existsSync(destination)) fs.chmodSync(destination, 0o644);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
