import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { preserveColdRowDiagnostics } from "../../../../utils/src/preserveColdRowDiagnostics";

/**
 * Verifies partial cold diagnostics preserve stderr without reading live inputs.
 *
 * A failed process can have unconfirmed native closure. Its stderr snapshot is
 * still needed, while neither diagnostic text nor a vanished PID grants input
 * copying or reclamation. Closed rows retain their exact receipt bytes.
 *
 * 1. Export a partial row whose source does not exist and retain its stderr.
 * 2. Contrast a closed row containing an authored receipt and exact hash.
 * 3. Require original source bytes unchanged and disabled output to do no IO.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual diagnostic snapshot owner with partial and closed rows, reads the produced metadata and copied receipt bytes, and requires failed join/release flags and captured stderr to survive unchanged.
 * @evidence contracts/testing.md#independent-expectations A nonexistent partial source must never be enumerated; literal stderr and receipt bytes are authored independently, and the expected SHA is computed from those authored bytes rather than the generated copy.
 * @evidence contracts/testing.md#distinguishing-cases Partial unknown closure exports metadata only; closed but unsuccessful release remains false while copies are permitted by confirmed reader join. Disabled diagnostics do not create a destination or read a nonexistent source.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc runner calls a shared test helper against one temporary filesystem root; it starts no product host, native producer or consumer installation. Cold E2E remains the owner of original process lifetime assertions.
 */
export function test_partial_cold_diagnostics_preserve_stderr_without_copying_unknown_inputs(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cold-diagnostic-unit-"));
  try {
    const stderr = "session shutdown failed\nauthored original boundary refusal\n";
    const missing = path.join(root, "still-owned-source");
    const partial = preserveColdRowDiagnostics({ root: missing, diagnosticRoot: root }, false, false, stderr);
    assert.ok(partial);
    const metadata = JSON.parse(fs.readFileSync(path.join(partial, "row.jsonl"), "utf8"));
    assert.equal(metadata.stderr, stderr);
    assert.equal(metadata.joined, false);
    assert.equal(metadata.releaseConfirmed, false);
    assert.equal(metadata.partial, true);
    assert.deepEqual(metadata.files, []);
    assert.equal(fs.existsSync(missing), false);
    const source = path.join(root, "closed");
    fs.mkdirSync(source);
    const bytes = Buffer.from('{"receipt":"authored original bytes"}\n');
    fs.writeFileSync(path.join(source, "receipt.jsonl"), bytes);
    const closed = preserveColdRowDiagnostics({ root: source, diagnosticRoot: root }, true, false, stderr);
    assert.ok(closed);
    const receipt = JSON.parse(fs.readFileSync(path.join(closed, "row.jsonl"), "utf8"));
    assert.equal(receipt.joined, true);
    assert.equal(receipt.releaseConfirmed, false);
    assert.equal(receipt.partial, false);
    assert.deepEqual(receipt.files, [{ file: "receipt.jsonl", size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }]);
    assert.deepEqual(fs.readFileSync(path.join(closed, "receipt.jsonl")), bytes);
    assert.deepEqual(fs.readFileSync(path.join(source, "receipt.jsonl")), bytes);
    assert.equal(preserveColdRowDiagnostics({ root: missing }, false, false, stderr), undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
