import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertSharedHostCompatibility } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/assertSharedHostCompatibility";
import { pluginLabel } from "../../../../../packages/ttsc/src/plugin/internal/load/pluginLabel";
import { resolveNativeSource } from "../../../../../packages/ttsc/src/plugin/internal/load/resolveNativeSource";
import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source ownership is derived from actual Go packages, never labels.
 *
 * The replaced CLI compiled two empty main programs only to reject their
 * incompatible owners. Actual source classification and the actual pass guard
 * make that decision before any program execution, so this unit owns both.
 *
 * 1. Classify the original fake-banner and fake-strip Go main inputs.
 * 2. Reject distinct executable owners in both pass kinds and accept shared
 *    owners.
 * 3. Classify linked and invalid production-package controls and label fallbacks.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveNativeSource classifies two Go main packages named like built-in plugins as executable and a non-main package under an arbitrary label as linked; assertSharedHostCompatibility then throws the exact emit and source-to-source messages for two executables with different binaries, accepts equal binaries, an empty list and a single plugin, skips a linked transform contributor, and still throws when that contributor is check-stage; a directory without a valid production package is refused and pluginLabel falls back from name to specifier to #index.
 * @evidence contracts/testing.md#independent-expectations Literal package declarations and original module names establish executable versus library ownership independently of descriptor names; complete diagnostics and actual module roots are independently expected.
 * @evidence contracts/testing.md#distinguishing-cases Owns two fake built-in labels on distinct main packages, both pass errors, equal-owner acceptance, real linked exclusion, check-stage non-exclusion, test-only/no-package refusal and name/specifier/index label fallback.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit export imports authored classifier, label and pass-guard functions directly; source filesystem fixtures and actual Go metadata commands establish ownership, without a descriptor evaluator, native producer build or supplied fake capability.
 */
export function test_native_source_classification_keeps_fake_labels_out_of_host_ownership(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("native-source-classification-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "native_source_classification_keeps_fake_labels_out_of_host_ownership",
      "inputs-1",
    ),
    root,
  );
  for (const directory of ["fake-banner", "fake-strip", "linked", "no-package"])
    fs.renameSync(
      path.join(root, directory, "main.go.txt"),
      path.join(root, directory, "main.go"),
    );
  fs.renameSync(
    path.join(root, "no-package", "only_test.go.txt"),
    path.join(root, "no-package", "only_test.go"),
  );
  const mainA = path.join(root, "fake-banner");
  const mainB = path.join(root, "fake-strip");
  const sources = [mainA, mainB, path.join(root, "linked"), path.join(root, "no-package")];
  const observations = NativeSourcePackages.ownPackages(
    sources.map((source) => ({ source, label: path.basename(source) })), process.env,
  );
  const classify = (source: string, name: string) =>
    resolveNativeSource(
      source,
      { name, source },
      { transform: "./plugins/" + name + ".cjs" },
      0,
      { observation: observations[sources.indexOf(source)]! },
    );
  const a = classify(mainA, "@ttsc/banner");
  const b = classify(mainB, "@ttsc/strip");
  assert.deepEqual(a, { kind: "executable", moduleRoot: mainA });
  assert.deepEqual(b, { kind: "executable", moduleRoot: mainB });
  const record = (
    source: string,
    name: string,
    resolved: typeof a,
  ): ITtscLoadedNativePlugin => ({
    source,
    name,
    kind: resolved.kind,
    config: { transform: name },
    stage: "transform",
    binary: path.join(resolved.moduleRoot, "selected-binary"),
  });
  const first = record(mainA, "@ttsc/banner", a);
  const second = record(mainB, "@ttsc/strip", b);
  assert.throws(() => assertSharedHostCompatibility([first, second], "emit"), {
    message:
      "ttsc: multiple compiler native backends cannot share one emit pass; compose transform libraries through one aggregate native host",
  });
  assert.throws(
    () => assertSharedHostCompatibility([first, second], "source-to-source"),
    {
      message:
        "ttsc: multiple transform native backends cannot share one source-to-source pass; compose transform libraries through one aggregate native host",
    },
  );
  assertSharedHostCompatibility(
    [first, { ...second, binary: first.binary }],
    "emit",
  );
  assertSharedHostCompatibility([], "emit");
  assertSharedHostCompatibility([first], "source-to-source");
  const library = path.join(root, "linked");
  const linked = classify(library, "arbitrary-label");
  assert.deepEqual(linked, { kind: "linked", moduleRoot: library });
  const contributor = record(library, "arbitrary-label", linked);
  assertSharedHostCompatibility([contributor, first], "emit");
  assert.throws(
    () =>
      assertSharedHostCompatibility(
        [{ ...contributor, stage: "check" }, first],
        "emit",
      ),
    /multiple compiler native backends/,
  );
  const invalid = path.join(root, "no-package");
  assert.throws(() => classify(invalid, "missing-package"), /expected 'package'/);
  assert.equal(
    pluginLabel(
      { name: "chosen", source: mainA },
      { transform: "specifier" },
      7,
    ),
    "chosen",
  );
  assert.equal(
    pluginLabel({ name: "", source: mainA }, { transform: "specifier" }, 7),
    "specifier",
  );
  assert.equal(
    pluginLabel({ name: "", source: mainA }, { transform: "" }, 7),
    "#7",
  );
}
