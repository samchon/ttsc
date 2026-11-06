import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runtimeExecutableIdentity } from "../../../../../packages/ttsc/src/internal/runtimeExecutableIdentity";

/**
 * Verifies completed-plugin identity separates proven bytes from metadata-only
 * changes while existing callers retain strict executable identity.
 *
 * 1. Capture strict and content identities of one real regular file.
 * 2. Change its modification stamp without changing bytes or native mode.
 * 3. Change equal-length bytes, restore mtime, and refuse missing/non-file input.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native observations and streamed hashes produce equal plugin-content keys only after a metadata-only edit. Default strict keys must change, and a same-size restored-mtime content edit must change both identities.
 * @evidence contracts/testing.md#independent-expectations Literal program1/program2 bytes and two explicit timestamps independently distinguish equal content from changed native observations; undefined is required for absent and directory coordinates.
 * @evidence contracts/testing.md#distinguishing-cases Default strict versus explicit content projection, metadata-only edits versus actual byte changes, and missing versus non-file inputs cover the new projection without changing existing default semantics. Existing runtime capability cases own executable execution and persistent digest reuse.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls the production identity owner on private regular files without launching an executable, installer, compiler or product host; synchronous reads finish before root removal.
 */
export function test_runtime_executable_content_identity_ignores_only_metadata(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-executable-content-"),
  );
  try {
    const file = path.join(root, "program.bin");
    fs.writeFileSync(file, "program1");
    fs.utimesSync(file, new Date(1000), new Date(1000));
    const strict = runtimeExecutableIdentity(file);
    const content = runtimeExecutableIdentity(file, undefined, false);
    assert.ok(strict);
    assert.ok(content);
    fs.utimesSync(file, new Date(2000), new Date(2000));
    const changedMetadata = runtimeExecutableIdentity(file);
    assert.ok(changedMetadata);
    assert.notEqual(changedMetadata, strict);
    assert.equal(runtimeExecutableIdentity(file, undefined, false), content);
    fs.writeFileSync(file, "program2");
    fs.utimesSync(file, new Date(2000), new Date(2000));
    const changedStrict = runtimeExecutableIdentity(file);
    const changedContent = runtimeExecutableIdentity(file, undefined, false);
    assert.ok(changedStrict);
    assert.ok(changedContent);
    assert.notEqual(changedStrict, changedMetadata);
    assert.notEqual(changedContent, content);
    fs.unlinkSync(file);
    assert.equal(runtimeExecutableIdentity(file, undefined, false), undefined);
    assert.equal(runtimeExecutableIdentity(root, undefined, false), undefined);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
