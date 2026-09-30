import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { rejectJsTransformFunctions } from "../../../../../packages/ttsc/src/plugin/internal/load/rejectJsTransformFunctions";
import { requirePluginSource } from "../../../../../packages/ttsc/src/plugin/internal/load/requirePluginSource";
import { validatePluginContributors } from "../../../../../packages/ttsc/src/plugin/internal/load/validatePluginContributors";
import { validatePluginSource } from "../../../../../packages/ttsc/src/plugin/internal/load/validatePluginSource";
import type { ITtscPlugin } from "../../../../../packages/ttsc/src/structures/ITtscPlugin";

/**
 * Verifies authored descriptor admission without evaluator or native builds.
 *
 * Descriptor errors are decided before native compilation. These cases call
 * those owning operations with the original missing/empty/absent/duplicate
 * inputs and stronger exact diagnostics; one CLI survivor retains error transport.
 *
 * 1. Validate source values and both prohibited JavaScript transform keys.
 * 2. Probe an existing and absent actual source path with exact guidance.
 * 3. Validate contributor ordering, source boundaries and physical identities.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls all four actual production guards and checks exact source/JavaScript-transform/duplicate diagnostics plus source-directory and contributor normalization behavior.
 * @evidence contracts/testing.md#independent-expectations Literal error strings, explicit source fixtures and normalized physical paths establish independent expected results rather than copying function outputs.
 * @evidence contracts/testing.md#distinguishing-cases Owns absent/empty/nonstring/valid source, inherited and undefined JavaScript keys, missing path guidance, contributor array/name/duplicate/path/buildable-source rejection and ordered successful records.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit export directly imports authored production guards; no descriptor evaluator, Go invocation or simulated native capability is used.
 */
export function test_descriptor_validation_preserves_source_and_contributor_rejections(): void {
  const plugin = (value: unknown): ITtscPlugin => value as ITtscPlugin;
  for (const source of [undefined, "", null, 42]) {
    assert.throws(() => validatePluginSource(plugin({ name: "empty", source })), { message: "ttsc: plugin must declare source" });
  }
  validatePluginSource(plugin({ name: "valid", source: "literal-source" }));
  rejectJsTransformFunctions("./plugins/valid.cjs", {});
  for (const candidate of [{ transformOutput: undefined }, { transformSource: () => "" }, Object.create({ transformOutput: true })]) {
    assert.throws(() => rejectJsTransformFunctions("./plugins/invalid-js-transform.cjs", candidate), { message: 'ttsc: plugin "./plugins/invalid-js-transform.cjs" declares unsupported JS transform functions; declare a native backend instead' });
  }
  const root = TestProject.tmpdir("descriptor-validation-");
  const absent = path.join(root, "no-such-dir");
  requirePluginSource(root, "valid");
  assert.throws(() => requirePluginSource(absent, "missing"), { message: `ttsc: plugin "missing" source does not exist: ${absent}\n  Plugin descriptors run without CommonJS globals: __dirname, __filename, and require are undefined when ttsc loads a descriptor through ttsx or as ESM. If this path was derived from one of them, use context.dirname / context.filename (the descriptor's own directory and file, populated in every load mode), or resolve it from context.projectRoot, e.g. createRequire(path.join(context.projectRoot, "package.json")).resolve("<your-package>/package.json").` });
  const sourceA = path.join(root, "contrib_a");
  const sourceB = path.join(root, "contrib_b");
  fs.mkdirSync(sourceA); fs.mkdirSync(sourceB);
  fs.writeFileSync(path.join(sourceA, "a.go"), "package dupe\n");
  fs.writeFileSync(path.join(sourceB, "b.go"), "package dupe\n");
  const validate = (contributors: unknown) => validatePluginContributors(plugin({ name: "host", contributors }));
  assert.equal(validate(undefined), undefined);
  assert.equal(validate([]), undefined);
  assert.deepEqual(validate([{ name: "first", source: sourceA }, { name: "second", source: sourceB }]), [{ name: "first", source: fs.realpathSync(sourceA) }, { name: "second", source: fs.realpathSync(sourceB) }]);
  assert.throws(() => validate([{ name: "dupe", source: sourceA }, { name: "dupe", source: sourceB }]), { message: 'ttsc: plugin "host" contributors[1] duplicate name "dupe"' });
  assert.throws(() => validate({}), { message: 'ttsc: plugin "host" "contributors" must be an array of { name, source } entries' });
  assert.throws(() => validate([null]), { message: 'ttsc: plugin "host" contributors[0] must be an object' });
  assert.throws(() => validate([{ name: "Bad-name", source: sourceA }]), { message: 'ttsc: plugin "host" contributors[0].name must match /^[a-z][a-z0-9_]*$/; got "Bad-name"' });
  assert.throws(() => validate([{ name: "valid", source: "" }]), { message: 'ttsc: plugin "host" contributors[0].source must be a non-empty string' });
  assert.throws(() => validate([{ name: "valid", source: "relative" }]), { message: 'ttsc: plugin "host" contributors[0].source must be an absolute path; got "relative"' });
  assert.throws(() => validate([{ name: "valid", source: absent }]), { message: `ttsc: plugin "host" contributors[0].source must be an existing directory: ${absent}` });
  const testOnly = path.join(root, "test-only"); fs.mkdirSync(testOnly); fs.writeFileSync(path.join(testOnly, "only_test.go"), "package valid\n");
  assert.throws(() => validate([{ name: "valid", source: testOnly }]), { message: `ttsc: plugin "host" contributors[0].source must contain at least one non-test ".go" file: ${testOnly}` });
}
