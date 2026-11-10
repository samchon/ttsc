import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeInputProof } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputProof";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies retained input predicates against actual portable filesystem
 * changes.
 *
 * 1. Admit a BOM-decoded source, raw host input and an absent candidate.
 * 2. Contrast directory membership, content changes and missing proof.
 * 3. Refuse a changed, newly set or newly unset recorded environment read.
 * 4. Refuse producer-declared incompleteness and unsupported native codecs.
 *
 * @evidence contracts/testing.md#behavioral-verification Production admission reads real files and compares authored witnesses; equivalent compiler text with different BOM bytes stays valid until the independent raw host witness is supplied, while source changes, candidate creation and directory members invalidate reuse. A recorded environment read admits only the build environment that still has its value or absence.
 * @evidence contracts/testing.md#independent-expectations Standard SHA-256 of authored text and raw bytes supplies the two distinct witness codecs. Literal existence, sorted members and failure markers define expectations without calling a product hash helper. Environment expectations are the literal recorded values and authored environments.
 * @evidence contracts/testing.md#distinguishing-cases UTF-8/UTF-16 BOM equivalence contrasts raw-byte inequality; absent/present candidates, empty/nonempty directories, complete/incomplete producers and supported/unknown codecs distinguish admission from fallback. Environment cases contrast an equal value with a changed value, a recorded absence that became set, a recorded value that became unset, and an unrelated variable that changed without being recorded.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls portable production predicate semantics; no native compiler, artifact build or installed consumer is involved.
 */
export function test_runtimeinputproof_replays_content_absence_and_membership(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-input-proof-")),
  );
  const source = path.join(root, "source.ts");
  const candidate = path.join(root, "missing.ts");
  const directory = path.join(root, "members");
  const hash = (bytes: string | Buffer): string =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  const text = "export const value = 7;\n";
  fs.mkdirSync(directory);
  fs.writeFileSync(
    source,
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]),
  );
  const result: TtscBuildResult = {
    status: 0,
    diagnostics: [],
    stdout: "",
    stderr: "",
    graph: {
      edges: {},
      globals: [],
      configs: [],
      useCaseSensitiveFileNames: true,
      inputObservations: {
        "source.ts": { readFile: { ok: true, hash: hash(text) } },
        "missing.ts": { fileExists: false, stat: "missing" },
        members: {
          directoryExists: true,
          accessibleEntries: { directories: [], files: [] },
        },
      },
    },
  };
  const sourceObservation = result.graph!.inputObservations!["source.ts"]!;
  let environment: NodeJS.ProcessEnv = {};
  const holds = (): boolean =>
    RuntimeInputProof.holds(result, root, path.join(root, "emit"), environment);
  try {
    assert.equal(holds(), true);
    const raw = fs.readFileSync(source);
    sourceObservation.nativePredicates = [
      {
        version: 1,
        kind: "file",
        digest: hash(raw),
        realpath: source,
        identityStable: true,
        scope: "cache",
      },
    ];
    assert.equal(holds(), true);
    fs.writeFileSync(source, Buffer.from(text));
    assert.equal(holds(), false);
    fs.writeFileSync(source, raw);
    delete sourceObservation.nativePredicates;
    fs.writeFileSync(
      source,
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
    );
    assert.equal(holds(), true);
    result.hostInputs = [source];
    result.hostInputHashes = {
      [source]: hash(
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]),
      ),
    };
    result.hostInputRealpaths = { [source]: fs.realpathSync.native(source) };
    assert.equal(holds(), false);
    result.hostInputHashes[source] = hash(fs.readFileSync(source));
    assert.equal(holds(), true);
    result.hostInputs.push(directory);
    result.hostInputHashes[directory] = hash("ttsc:host-input:directory\0");
    result.hostInputRealpaths[directory] = fs.realpathSync.native(directory);
    assert.equal(holds(), true);
    fs.rmdirSync(directory);
    fs.writeFileSync(directory, "replaced directory");
    assert.equal(holds(), false);
    fs.unlinkSync(directory);
    fs.mkdirSync(directory);
    assert.equal(holds(), true);
    fs.writeFileSync(candidate, "export {};\n");
    assert.equal(holds(), false);
    fs.unlinkSync(candidate);
    fs.writeFileSync(path.join(directory, "added.ts"), "export {};\n");
    assert.equal(holds(), false);
    fs.unlinkSync(path.join(directory, "added.ts"));
    assert.equal(holds(), true);
    result.environmentInputs = {
      TTSC_TEST_TRACKED_ENV_MODE: "test",
      TTSC_TEST_TRACKED_ENV_UNSET: null,
    };
    environment = {
      TTSC_TEST_TRACKED_ENV_MODE: "test",
      TTSC_TEST_UNRECORDED: "a",
    };
    assert.equal(holds(), true, "the recorded environment still holds");
    environment = {
      TTSC_TEST_TRACKED_ENV_MODE: "test",
      TTSC_TEST_UNRECORDED: "b",
    };
    assert.equal(holds(), true, "an unrecorded variable is not an input");
    environment = { TTSC_TEST_TRACKED_ENV_MODE: "production" };
    assert.equal(holds(), false, "a changed value is a changed input");
    environment = {
      TTSC_TEST_TRACKED_ENV_MODE: "test",
      TTSC_TEST_TRACKED_ENV_UNSET: "",
    };
    assert.equal(holds(), false, "a recorded absence must stay absent");
    environment = {};
    assert.equal(holds(), false, "a recorded value must stay set");
    environment = { TTSC_TEST_TRACKED_ENV_MODE: "test" };
    assert.equal(holds(), true);
    result.observationsComplete = false;
    assert.equal(holds(), false);
    delete result.observationsComplete;
    delete result.hostInputRealpaths[source];
    assert.equal(holds(), false);
    result.hostInputRealpaths[source] = fs.realpathSync.native(source);
    result.graph!.inputProofFailures = { "source.ts": "content-changed" };
    assert.equal(holds(), false);
    delete result.graph!.inputProofFailures;
    sourceObservation.nativePredicates = [
      {
        version: 2,
        kind: "file",
        digest: hash(fs.readFileSync(source)),
        realpath: source,
        identityStable: true,
      } as never,
    ];
    assert.equal(holds(), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
