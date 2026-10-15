import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { readCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/readCapabilityResolution";
import { writeCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/writeCapabilityResolution";

interface Observation {
  complete: boolean;
  hashes: Record<string, string | null>;
  inputs: string[];
  realpaths: Record<string, string | null>;
}

interface Recorder {
  beginResolution(specifier: string, parent: string): unknown;
  endResolution(token: unknown, selected: string | undefined): void;
  finish(): Observation;
}

const { createResolutionInputRecorder } = createRequire(import.meta.url)(
  fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs",
      import.meta.url,
    ),
  ),
) as {
  createResolutionInputRecorder(options: { extensions: string[] }): Recorder;
};

/**
 * Verifies a selected file cannot borrow a missing-candidate cache proof.
 *
 * A custom resolver can select a path outside the enumerated candidates and
 * return that path without loading it. An absent selected file is still an
 * input, but a null hash and physical path cannot prove that selection.
 *
 * 1. Settle path and file-URL selections outside candidate enumeration while their
 *    files are absent or removed.
 * 2. Compare a present selected file, a failed lookup and a non-file URL.
 * 3. Assert only the absent selected files lose reusable proof in both caches.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises the production recorder's begin/end/finish seam with a custom resolver's possible selected values, then passes its exact observations to the real descriptor and capability cache writers/readers: vanished selections never replay while stable selections do.
 * @evidence contracts/testing.md#independent-expectations Literal selected paths outside the ordinary package candidates and native file existence define the oracle; SHA-256 over authored bytes and native realpath define the healthy proof independently of the recorder.
 * @evidence contracts/testing.md#distinguishing-cases Covers an absent path selection, an existing file removed before settlement, a present file, a failed resolution's legitimate null candidate, and a non-file builtin URL. Both caches refuse the absent selection but replay the stable selection; actual hook ordering belongs to runtime integration tests.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit directly calls the shared recorder over one owned temporary tree, without installing a global resolver hook, starting a native host, or running a full transform. Finally removes its tree.
 */
export function test_resolution_input_recorder_requires_positive_selected_file_proof(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-selected-proof-")),
  );
  const parent = path.join(root, "entry.cjs");
  fs.writeFileSync(parent, "// importer\n");
  const recorder = (): Recorder =>
    createResolutionInputRecorder({ extensions: [".cjs", ".js"] });
  const refused = (result: Observation, selected: string): void => {
    assert.equal(result.complete, true);
    assert.ok(result.inputs.includes(selected), selected);
    assert.equal(Object.hasOwn(result.hashes, selected), false, selected);
    assert.equal(Object.hasOwn(result.realpaths, selected), false, selected);
  };
  try {
    const absent = path.join(root, "external", "virtual.cjs");
    const missingPath = recorder();
    missingPath.endResolution(
      missingPath.beginResolution("virtual", parent),
      absent,
    );
    const vanished = missingPath.finish();
    refused(vanished, absent);
    fs.mkdirSync(path.dirname(absent));
    fs.writeFileSync(absent, "module.exports=1;\n");
    refused(missingPath.finish(), absent);

    const removed = path.join(root, "external", "removed.cjs");
    fs.writeFileSync(removed, "module.exports=2;\n");
    const removedFile = recorder();
    const removedToken = removedFile.beginResolution("removed", parent);
    fs.rmSync(removed);
    removedFile.endResolution(removedToken, pathToFileURL(removed).href);
    refused(removedFile.finish(), removed);

    const present = path.join(root, "external", "present.cjs");
    const contents = "module.exports=3;\n";
    fs.writeFileSync(present, contents);
    const presentFile = recorder();
    presentFile.endResolution(
      presentFile.beginResolution("present", parent),
      present,
    );
    const proven = presentFile.finish();
    assert.equal(proven.complete, true);
    assert.equal(
      proven.hashes[present],
      crypto.createHash("sha256").update(contents).digest("hex"),
    );
    assert.equal(proven.realpaths[present], fs.realpathSync.native(present));

    const descriptorEntry = path.join(root, "descriptor.json");
    const descriptorEvaluation = (observed: Observation) => ({
      descriptor: { hostInputHashes: {} },
      hostInputHashes: observed.hashes,
      hostInputRealpaths: observed.realpaths,
      inputs: observed.inputs,
      observationsComplete: observed.complete,
    });
    PluginDescriptorEvaluationCache.write(
      descriptorEntry,
      descriptorEvaluation(vanished),
    );
    assert.equal(PluginDescriptorEvaluationCache.read(descriptorEntry), null);
    PluginDescriptorEvaluationCache.write(
      descriptorEntry,
      descriptorEvaluation(proven),
    );
    assert.deepEqual(
      PluginDescriptorEvaluationCache.read(descriptorEntry),
      descriptorEvaluation(proven),
    );

    const capabilityKey = {
      cwd: root,
      env: { TTSC_CACHE_DIR: path.join(root, "capability-cache") },
      tsconfig: "tsconfig.json",
      version: "selected-proof-fixture",
    };
    const capabilityAnswer = (observed: Observation) => ({
      hostInputHashes: observed.hashes,
      hostInputRealpaths: observed.realpaths,
      hostInputs: observed.inputs,
      manifest: "[]",
      pluginSources: {},
      plugins: [],
      projectContext: null,
    });
    assert.equal(
      writeCapabilityResolution(capabilityKey, capabilityAnswer(vanished)),
      null,
    );
    assert.equal(readCapabilityResolution(capabilityKey), null);
    assert.notEqual(
      writeCapabilityResolution(capabilityKey, capabilityAnswer(proven)),
      null,
    );
    assert.notEqual(readCapabilityResolution(capabilityKey), null);

    const failed = recorder();
    failed.endResolution(failed.beginResolution("missing", parent), undefined);
    const missingCandidate = path.join(
      root,
      "node_modules",
      "missing",
      "package.json",
    );
    const failedResult = failed.finish();
    assert.ok(failedResult.inputs.includes(missingCandidate));
    assert.equal(failedResult.hashes[missingCandidate], null);
    assert.equal(failedResult.realpaths[missingCandidate], null);

    const builtin = recorder();
    builtin.endResolution(
      builtin.beginResolution("node:fs", parent),
      "node:fs",
    );
    assert.equal(
      builtin.finish().inputs.includes(path.resolve("node:fs")),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
