import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { resolveProjectSelection } from "../../../../../packages/unplugin/src/core/transform/tsconfig/resolveProjectSelection";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import type { TtscWatchInputEvidence } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInputEvidence";
import { notifyRejectedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyRejectedGenerationInputs";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a generation-free rejection retains its known explicit config as a
 * module recovery dependency even when project discovery consulted nothing.
 *
 * An explicit project bypasses discovery. That empty routing history cannot
 * erase the config the delivery already selected, or config edits would have no
 * recovery registration after a compile could not start.
 *
 * 1. Select a real explicit config through the actual selection operation and
 *    require a failed recovery batch containing that config with current
 *    bytes.
 * 2. Supply an additional consulted routing config and the selected config;
 *    require both once, preserving batching preference and failed status.
 * 3. Omit the batch hook and require the single-input callback to retain the same
 *    known config and current host-byte evidence.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveProjectSelection produces empty consulted inputs for an explicit native config, then notifyRejectedGenerationInputs receives an ordinary Error without any generation and invokes module recovery callbacks. Exact selected config retention prevents the empty-routing-history registration gap; consulted extras remain registered.
 * @evidence contracts/testing.md#independent-expectations Literal native selected and routing paths define the recovery set. Node crypto hashes independently read fixture bytes under the supported host SHA-256 codec. Literal failed=true and one registration per spelling specify callback meaning; no generation, selector output or product hash helper supplies expected recovery inputs. Native identity equality is observed independently during setup, while this case does not certify the internal comparison-key encoding.
 * @evidence contracts/testing.md#distinguishing-cases Empty actual explicit-selection history contrasts with extra consulted routing input and a duplicate selected spelling. Batch hooks take precedence over a supplied single hook; when batching is absent the single hook still receives the selected config. Ordinary rejection is deliberately not the unstable-generation branch, whose retained-generation recovery has separate ownership.
 * @evidence contracts/testing.md#execution-ownership One discoverable direct unit uses supported selection and watch-hook arguments and a real fixture filesystem. It constructs no generation or private cache authority and starts no compiler, native watcher or product host. Its module callback trace proves registration only, not a consumer host's subsequent edit delivery.
 */
export async function test_rejected_generation_keeps_the_explicit_config_for_recovery(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.createProject({
      "tsconfig.json": '{"files":["src/main.ts"]}\n',
      "routing.json": '{"references":[{"path":"."}]}\n',
      "src/main.ts": "export const value = 1;\n",
    }),
  );
  const selected = path.join(root, "tsconfig.json");
  const routing = path.join(root, "routing.json");
  const file = path.join(root, "src/main.ts");
  const filesystem = DEFAULT_FILESYSTEM_OPERATIONS;
  const selection = resolveProjectSelection(file, selected, filesystem);
  assert.equal(selection.tsconfig, selected);
  assert.deepEqual(
    selection.consulted,
    [],
    "explicit selection has no discovery history",
  );
  assert.equal(fs.realpathSync.native(selected), selected);
  const rejection = new Error("ordinary compile startup rejection");
  const expectedHash = (location: string): string =>
    crypto.createHash("sha256").update(fs.readFileSync(location)).digest("hex");
  const expectedFiles = [selected, routing].sort();
  const batches: {
    inputs: readonly TtscWatchInput[];
    failed: boolean | undefined;
  }[] = [];
  const single: {
    file: string;
    evidence: TtscWatchInputEvidence | undefined;
  }[] = [];
  const hooks = {
    addWatchFiles: (inputs: readonly TtscWatchInput[], failed?: boolean) => {
      batches.push({ inputs, failed });
    },
    addWatchFile: (input: string, evidence?: TtscWatchInputEvidence) => {
      single.push({ file: input, evidence });
    },
  };
  notifyRejectedGenerationInputs(hooks, rejection, file, {
    ...selection,
    filesystem,
  });
  assert.equal(batches.length, 1, "one module recovery batch");
  assert.equal(batches[0]!.failed, true);
  assert.deepEqual(
    batches[0]!.inputs.map((input) => input.file),
    [selected],
  );
  assert.deepEqual(batches[0]!.inputs[0]!.evidence?.state, {
    codec: "host",
    hash: expectedHash(selected),
  });
  assert.equal(batches[0]!.inputs[0]!.evidence?.missing, false);
  assert.deepEqual(single, [], "batch registration owns this delivery");

  notifyRejectedGenerationInputs(hooks, rejection, file, {
    ...selection,
    filesystem,
    consulted: [routing, selected],
  });
  assert.equal(batches.length, 2);
  assert.equal(batches[1]!.failed, true);
  assert.deepEqual(
    batches[1]!.inputs.map((input) => input.file).sort(),
    expectedFiles,
  );
  for (const input of batches[1]!.inputs) {
    assert.deepEqual(input.evidence?.state, {
      codec: "host",
      hash: expectedHash(input.file),
    });
    assert.equal(input.evidence?.missing, false);
  }
  assert.deepEqual(single, []);

  notifyRejectedGenerationInputs(
    { addWatchFile: hooks.addWatchFile },
    rejection,
    file,
    { ...selection, filesystem },
  );
  assert.deepEqual(
    single.map((input) => input.file),
    [selected],
    "single-hook recovery retains explicit config",
  );
  assert.deepEqual(single[0]!.evidence?.state, {
    codec: "host",
    hash: expectedHash(selected),
  });
  assert.equal(single[0]!.evidence?.missing, false);
  assert.equal(
    batches.length,
    2,
    "single delivery does not invent a batch callback",
  );
}
