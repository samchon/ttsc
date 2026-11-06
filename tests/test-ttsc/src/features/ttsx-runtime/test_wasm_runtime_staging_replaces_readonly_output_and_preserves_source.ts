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
 * 3. Refuse nonordinary, hard-linked and SDK-alias destinations before mutation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual staging function overwrites a read-only generated file twice and preserves SDK bytes/permissions. Directory, shared-inode and source-as-destination refusal must happen before chmod or copying, preserving every neighboring authored body and permission bit.
 * @evidence contracts/testing.md#independent-expectations Authored v1/v2 source bytes, explicit read-only/writable permission bits and a distinct authored directory determine the expected behavior.
 * @evidence contracts/testing.md#distinguishing-cases Read-only ordinary output and repeated changed-content staging contrast a directory, a hard-linked SDK inode, a hard-linked unrelated neighbor and the unlinked SDK itself as destination. Actual native hard-link creation supplies the identity cases; no mocked metadata or OS-name assumption does. The actual workspace build validates assembly.
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
    const shared = path.join(root, "shared.js");
    fs.linkSync(source, shared);
    assert.throws(
      () => stageWasmExec(source, shared),
      /shares native file identity/,
    );
    assert.equal(fs.readFileSync(source, "utf8"), "runtime-v2");
    assert.equal(fs.statSync(source).mode & 0o200, 0);
    assert.equal(fs.statSync(shared).mode & 0o200, 0);
    fs.chmodSync(source, 0o644);
    fs.unlinkSync(shared);
    fs.chmodSync(source, 0o444);
    assert.throws(
      () => stageWasmExec(source, source),
      /shares native file identity/,
    );
    assert.equal(fs.statSync(source).mode & 0o200, 0);
    assert.equal(fs.readFileSync(source, "utf8"), "runtime-v2");
    const neighbor = path.join(root, "neighbor.js");
    fs.writeFileSync(neighbor, "preserved neighbor");
    fs.chmodSync(neighbor, 0o444);
    fs.linkSync(neighbor, shared);
    try {
      assert.throws(
        () => stageWasmExec(source, shared),
        /shares native file identity/,
      );
      assert.equal(fs.readFileSync(neighbor, "utf8"), "preserved neighbor");
      assert.equal(fs.readFileSync(shared, "utf8"), "preserved neighbor");
      assert.equal(fs.statSync(neighbor).mode & 0o200, 0);
      assert.equal(fs.statSync(source).mode & 0o200, 0);
    } finally {
      fs.chmodSync(neighbor, 0o644);
    }
  } finally {
    if (fs.existsSync(source)) fs.chmodSync(source, 0o644);
    if (fs.existsSync(destination)) fs.chmodSync(destination, 0o644);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
