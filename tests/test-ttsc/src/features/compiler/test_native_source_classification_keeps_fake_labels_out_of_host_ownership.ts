import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { assertSharedHostCompatibility } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/assertSharedHostCompatibility";
import { pluginLabel } from "../../../../../packages/ttsc/src/plugin/internal/load/pluginLabel";
import { resolveNativeSource } from "../../../../../packages/ttsc/src/plugin/internal/load/resolveNativeSource";
import type { ITtscPlugin } from "../../../../../packages/ttsc/src/structures/ITtscPlugin";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";

/**
 * Verifies source ownership is derived from actual Go packages, never labels.
 *
 * The replaced CLI compiled two empty main programs only to reject their
 * incompatible owners. Actual source classification and the actual pass guard
 * make that decision before any program execution, so this unit owns both.
 *
 * 1. Classify the original fake-banner and fake-strip Go main inputs.
 * 2. Reject distinct executable owners in both pass kinds and accept shared owners.
 * 3. Classify linked and invalid production-package controls and label fallbacks.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual source/module/package classification for the original fake-named Go main inputs, then actual shared-host compatibility with its returned kinds; checks complete original emit rejection and the source-to-source variant.
 * @evidence contracts/testing.md#independent-expectations Literal package declarations and original module names establish executable versus library ownership independently of descriptor names; complete diagnostics and actual module roots are independently expected.
 * @evidence contracts/testing.md#distinguishing-cases Owns two fake built-in labels on distinct main packages, both pass errors, equal-owner acceptance, real linked exclusion, check-stage non-exclusion, test-only/no-package refusal and name/specifier/index label fallback.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit export imports authored classifier, label and pass-guard functions directly; only source filesystem fixtures are created, without a descriptor evaluator, native build or supplied fake capability.
 */
export function test_native_source_classification_keeps_fake_labels_out_of_host_ownership(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("native-source-classification-"));
  const input = (directory: string, module: string, source: string): string => {
    const target = path.join(root, directory); fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "go.mod"), `module ${module}\n\ngo 1.26\n`);
    fs.writeFileSync(path.join(target, "main.go"), source); return target;
  };
  const mainA = input("fake-banner", "example.com/fakebanner", "package main\n\nfunc main() {}\n");
  const mainB = input("fake-strip", "example.com/fakestrip", "package main\n\nfunc main() {}\n");
  const classify = (source: string, name: string) => resolveNativeSource(source, { name, source }, { transform: "./plugins/" + name + ".cjs" }, 0);
  const a = classify(mainA, "@ttsc/banner"); const b = classify(mainB, "@ttsc/strip");
  assert.deepEqual(a, { kind: "executable", moduleRoot: mainA });
  assert.deepEqual(b, { kind: "executable", moduleRoot: mainB });
  const record = (source: string, name: string, resolved: typeof a): ITtscLoadedNativePlugin => ({
    source, name, kind: resolved.kind, config: { transform: name }, stage: "transform", binary: path.join(resolved.moduleRoot, "selected-binary"),
  });
  const first = record(mainA, "@ttsc/banner", a); const second = record(mainB, "@ttsc/strip", b);
  assert.throws(() => assertSharedHostCompatibility([first, second], "emit"), { message: "ttsc: multiple compiler native backends cannot share one emit pass; compose transform libraries through one aggregate native host" });
  assert.throws(() => assertSharedHostCompatibility([first, second], "source-to-source"), { message: "ttsc: multiple transform native backends cannot share one source-to-source pass; compose transform libraries through one aggregate native host" });
  assertSharedHostCompatibility([first, { ...second, binary: first.binary }], "emit");
  assertSharedHostCompatibility([], "emit"); assertSharedHostCompatibility([first], "source-to-source");
  const library = input("linked", "example.com/linked", "package actual_library\n");
  const linked = classify(library, "arbitrary-label"); assert.deepEqual(linked, { kind: "linked", moduleRoot: library });
  const contributor = record(library, "arbitrary-label", linked);
  assertSharedHostCompatibility([contributor, first], "emit");
  assert.throws(() => assertSharedHostCompatibility([{ ...contributor, stage: "check" }, first], "emit"), /multiple compiler native backends/);
  const invalid = input("no-package", "example.com/no_package", "// no production package declaration\n");
  fs.writeFileSync(path.join(invalid, "only_test.go"), "package main\n");
  assert.throws(() => classify(invalid, "missing-package"), { message: `ttsc: plugin "missing-package" source must contain at least one non-test ".go" file with a package declaration: ${invalid}` });
  assert.equal(pluginLabel({ name: "chosen", source: mainA }, { transform: "specifier" }, 7), "chosen");
  assert.equal(pluginLabel({ name: "", source: mainA }, { transform: "specifier" }, 7), "specifier");
  assert.equal(pluginLabel({ name: "", source: mainA } as ITtscPlugin, { transform: "" }, 7), "#7");
}
