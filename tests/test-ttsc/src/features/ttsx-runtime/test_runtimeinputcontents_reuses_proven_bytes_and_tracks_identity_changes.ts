import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeInputContents } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";

/**
 * Verifies selected-input witnesses preserve byte and physical freshness across
 * persistent metadata reuse, including same-size edits with restored mtimes.
 *
 * 1. Capture known bytes and an absent candidate with an actual identity store.
 * 2. Reopen the store, change equal-length bytes and restore their old mtime.
 * 3. Create/delete the candidate and replace a source's inode, asserting hashes.
 *
 * @evidence contracts/testing.md#behavioral-verification Production capture returns actual SHA-256/physical witnesses across independent store opens and must observe same-size restored-mtime changes, candidate creation/deletion and source replacement.
 * @evidence contracts/testing.md#independent-expectations Node's direct SHA-256 of authored a/b bytes and native realpath determine the expected witnesses; no persisted cache document supplies the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Stable reads, raw-byte edits, restored mtime, missing/present transitions and inode replacement contrast valid reuse with mandatory changed observations; Runtime E2E separately observes zero content reads on a warm hit.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers the named function and calls production capture/store operations over portable files without compiler, installation or host execution.
 */
export function test_runtimeinputcontents_reuses_proven_bytes_and_tracks_identity_changes(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-content-proof-"));
  try {
    const source = path.join(root, "source.ts");
    const absent = path.join(root, "candidate.ts");
    const subject = path.join(root, "tsconfig.json");
    fs.writeFileSync(source, "export const a = 1;");
    fs.writeFileSync(subject, "{}");
    const old = new Date(1000);
    fs.utimesSync(source, old, old);
    fs.utimesSync(subject, old, old);
    const capture = () =>
      RuntimeInputContents.capture(
        [source, absent],
        subject,
        PluginContentIdentities.open({
          projectRoot: root,
          cacheDir: path.join(root, "cache"),
          env: process.env,
        }),
      );
    const digest = (value: string) =>
      crypto.createHash("sha256").update(value).digest("hex");
    const expected = (value: string) => [
      source,
      fs.realpathSync.native(source),
      digest(value),
    ];
    assert.deepEqual(capture(), [
      expected("export const a = 1;"),
      [absent, null, null],
    ]);
    assert.deepEqual(capture(), [
      expected("export const a = 1;"),
      [absent, null, null],
    ]);
    fs.writeFileSync(source, "export const b = 2;");
    fs.utimesSync(source, old, old);
    assert.deepEqual(capture()[0], expected("export const b = 2;"));
    fs.writeFileSync(absent, "candidate");
    assert.deepEqual(capture()[1], [
      absent,
      fs.realpathSync.native(absent),
      digest("candidate"),
    ]);
    fs.unlinkSync(absent);
    fs.unlinkSync(source);
    fs.writeFileSync(source, "export const a = 1;");
    fs.utimesSync(source, old, old);
    assert.deepEqual(capture(), [
      expected("export const a = 1;"),
      [absent, null, null],
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
