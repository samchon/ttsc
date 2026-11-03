import assert from "node:assert/strict";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { canDeliverCompilerSnapshot } from "../../../../../packages/unplugin/src/core/transform/generation/canDeliverCompilerSnapshot";
import { compilerSnapshotFailureClassifier } from "../../../../../packages/unplugin/src/core/transform/generation/compilerSnapshotFailureClassifier";
import { createGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/createGenerationProofFailures";
import { mergeGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/mergeGenerationProofFailures";
import { recordGenerationProofFailure } from "../../../../../packages/unplugin/src/core/transform/generation/recordGenerationProofFailure";

/**
 * Verifies many concurrent source edits preserve current delivery while a
 * hidden unobserved-input failure still withdraws it.
 *
 * A bounded error message is a presentation decision. It cannot turn a large
 * coherent edit into failure or hide the one incompatible dependency after it.
 *
 * 1. Record more source changes than the printable diagnostic population.
 * 2. Assert captured output remains deliverable, then append an unknown input.
 * 3. Merge that truncated aggregate and require the refusal to stay sticky.
 *
 * @evidence contracts/testing.md#behavioral-verification Real production recording, merging and delivery admission classify every witness despite truncation; an unrecorded host input after the bound refuses delivery directly and after merging; a different generation's positive truncated summary also cannot certify omitted local inputs.
 * @evidence contracts/testing.md#independent-expectations An authored graph records every one of 64 source paths but no plugin.json; those explicit input boundaries determine compatibility independently of diagnostic limits.
 * @evidence contracts/testing.md#distinguishing-cases Many captured changes remain accepted, while one later unobserved change must refuse; merge cannot restore permission by retaining only the earlier compatible witnesses or borrowing an omitted-witness summary from another generation.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin source-unit runner discovers this export and calls only portable proof owners with handwritten data; no compiler or host runs.
 */
export function test_compiler_snapshot_summary_survives_diagnostic_truncation(): void {
  const root = path.resolve("many-source-edits");
  const names = Array.from({ length: 64 }, (_, index) => `source${index}.ts`);
  const result: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: {},
    graph: {
      compilationSnapshot: "one",
      configs: [],
      globals: [],
      edges: {},
      inputObservations: Object.fromEntries(
        names.map((file) => [file, { readFile: { ok: true, hash: "before" } }]),
      ),
    },
  };
  const classify = compilerSnapshotFailureClassifier(result, root)!;
  const failures = createGenerationProofFailures(classify);
  const admitted = () =>
    canDeliverCompilerSnapshot({
      result,
      projectRoot: root,
      failures,
      adopted: false,
    });
  for (const file of names)
    recordGenerationProofFailure(failures, {
      domain: "graph",
      kind: "content-changed",
      path: path.join(root, file),
    });
  assert.ok(
    failures.omitted > 0,
    "the scenario must exceed printable diagnostics",
  );
  assert.equal(admitted(), true);
  recordGenerationProofFailure(failures, {
    domain: "host",
    kind: "content-changed",
    path: path.join(root, "plugin.json"),
  });
  assert.equal(admitted(), false);
  const merged = createGenerationProofFailures(classify);
  mergeGenerationProofFailures(merged, failures);
  assert.equal(
    canDeliverCompilerSnapshot({
      result,
      projectRoot: root,
      failures: merged,
      adopted: false,
    }),
    false,
  );

  const foreign = structuredClone(result);
  foreign.graph!.compilationSnapshot = "another-generation";
  foreign.graph!.inputObservations!["plugin.json"] = {
    readFile: { ok: true, hash: "foreign" },
  };
  const foreignFailures = createGenerationProofFailures(
    compilerSnapshotFailureClassifier(foreign, root)!,
  );
  for (const file of names)
    recordGenerationProofFailure(foreignFailures, {
      domain: "graph",
      kind: "content-changed",
      path: path.join(root, file),
    });
  recordGenerationProofFailure(foreignFailures, {
    domain: "host",
    kind: "content-changed",
    path: path.join(root, "plugin.json"),
  });
  assert.equal(foreignFailures.snapshotCompatible, true);
  const local = createGenerationProofFailures(classify);
  mergeGenerationProofFailures(local, foreignFailures);
  assert.equal(
    canDeliverCompilerSnapshot({
      result,
      projectRoot: root,
      failures: local,
      adopted: false,
    }),
    false,
    "another generation's truncated summary cannot certify local inputs",
  );
}
