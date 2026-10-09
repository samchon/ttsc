import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginDescriptorAdmission } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorAdmission";
import { rejectJsTransformFunctions } from "../../../../../packages/ttsc/src/plugin/internal/load/rejectJsTransformFunctions";
import { requirePluginSource } from "../../../../../packages/ttsc/src/plugin/internal/load/requirePluginSource";
import { validatePluginContributors } from "../../../../../packages/ttsc/src/plugin/internal/load/validatePluginContributors";
import { validatePluginSource } from "../../../../../packages/ttsc/src/plugin/internal/load/validatePluginSource";
import { SourcePluginAdmission } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginAdmission";
import type { ITtscPlugin } from "../../../../../packages/ttsc/src/structures/ITtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies authored descriptor admission without evaluator or native builds.
 *
 * These guards own supplied descriptor/source admission. Their direct calls do
 * not establish evaluator acquisition, toolchain discovery or the complete
 * builder's execution order and native compilation.
 *
 * 1. Validate source values and both prohibited JavaScript transform keys.
 * 2. Probe an existing and absent actual source path with exact guidance.
 * 3. Validate contributor ordering, source boundaries and physical identities.
 * 4. Contrast export/stage rejection, actual go.mod existence, lexical cache
 *    containment and supplied managed/overlay module replacement policy.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual production descriptor and source admission operations; preserves original source/JavaScript/contributor checks and observes export identity, stage diagnostics, native go.mod existence, cache containment and replacement refusals.
 * @evidence contracts/testing.md#independent-expectations Literal error strings, explicit source fixtures and normalized physical paths establish independent expected results rather than copying function outputs.
 * @evidence contracts/testing.md#distinguishing-cases Original source/contributor boundaries remain; added controls contrast primitive/array/object exports, omitted/supported/removed/unknown stages, file/directory/absent go.mod, included/pruned/sibling caches and managed/overlay/ordinary replacements with first-error order.
 * @evidence contracts/testing.md#execution-ownership The named export directly imports production-used guards with owned filesystem inputs and supplied replacement records. It invokes no evaluator, Go or compiler; passing admission does not certify native acquisition, physical cache aliases, caller root exemptions or whole builder ordering.
 */
export function test_descriptor_validation_preserves_source_and_contributor_rejections(): void {
  const plugin = (value: unknown): ITtscPlugin => value as ITtscPlugin;
  for (const source of [undefined, "", null, 42]) {
    assert.throws(
      () => validatePluginSource(plugin({ name: "empty", source })),
      { message: "ttsc: plugin must declare source" },
    );
  }
  validatePluginSource(plugin({ name: "valid", source: "literal-source" }));
  rejectJsTransformFunctions("./plugins/valid.cjs", {});
  for (const candidate of [
    { transformOutput: undefined },
    { transformSource: () => "" },
    Object.create({ transformOutput: true }),
  ]) {
    assert.throws(
      () =>
        rejectJsTransformFunctions(
          "./plugins/invalid-js-transform.cjs",
          candidate,
        ),
      {
        message:
          'ttsc: plugin "./plugins/invalid-js-transform.cjs" declares unsupported JS transform functions; declare a native backend instead',
      },
    );
  }
  const root = TestProject.tmpdir("descriptor-validation-");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "descriptor_validation_preserves_source_and_contributor_rejections",
      "inputs-1",
    ),
    root,
  );
  for (const parts of [
    ["contrib_a", "a.go"],
    ["contrib_b", "b.go"],
    ["test-only", "only_test.go"],
  ]) {
    const file = path.join(root, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  const absent = path.join(root, "no-such-dir");
  requirePluginSource(root, "valid");
  assert.throws(() => requirePluginSource(absent, "missing"), {
    message: `ttsc: plugin "missing" source does not exist: ${absent}\n  Plugin descriptors run without CommonJS globals: __dirname, __filename, and require are undefined when ttsc loads a descriptor through ttsx or as ESM. If this path was derived from one of them, use context.dirname / context.filename (the descriptor's own directory and file, populated in every load mode), or resolve it from context.projectRoot, e.g. createRequire(path.join(context.projectRoot, "package.json")).resolve("<your-package>/package.json").`,
  });
  const sourceA = path.join(root, "contrib_a");
  const sourceB = path.join(root, "contrib_b");
  const validate = (contributors: unknown) =>
    validatePluginContributors(plugin({ name: "host", contributors }));
  assert.equal(validate(undefined), undefined);
  assert.equal(validate([]), undefined);
  assert.deepEqual(
    validate([
      { name: "first", source: sourceA },
      { name: "second", source: sourceB },
    ]),
    [
      { name: "first", source: fs.realpathSync.native(sourceA) },
      { name: "second", source: fs.realpathSync.native(sourceB) },
    ],
  );
  assert.throws(
    () =>
      validate([
        { name: "dupe", source: sourceA },
        { name: "dupe", source: sourceB },
      ]),
    { message: 'ttsc: plugin "host" contributors[1] duplicate name "dupe"' },
  );
  assert.throws(() => validate({}), {
    message:
      'ttsc: plugin "host" "contributors" must be an array of { name, source } entries',
  });
  assert.throws(() => validate([null]), {
    message: 'ttsc: plugin "host" contributors[0] must be an object',
  });
  assert.throws(() => validate([{ name: "Bad-name", source: sourceA }]), {
    message:
      'ttsc: plugin "host" contributors[0].name must match /^[a-z][a-z0-9_]*$/; got "Bad-name"',
  });
  assert.throws(() => validate([{ name: "valid", source: "" }]), {
    message:
      'ttsc: plugin "host" contributors[0].source must be a non-empty string',
  });
  assert.throws(() => validate([{ name: "valid", source: "relative" }]), {
    message:
      'ttsc: plugin "host" contributors[0].source must be an absolute path; got "relative"',
  });
  assert.throws(() => validate([{ name: "valid", source: absent }]), {
    message: `ttsc: plugin "host" contributors[0].source must be an existing directory: ${absent}`,
  });
  const testOnly = path.join(root, "test-only");
  assert.throws(() => validate([{ name: "valid", source: testOnly }]), {
    message: `ttsc: plugin "host" contributors[0].source must contain at least one non-test ".go" file: ${testOnly}`,
  });

  for (const value of [
    123,
    null,
    undefined,
    "descriptor",
    false,
    [],
    () => ({}),
  ]) {
    assert.throws(
      () =>
        PluginDescriptorAdmission.descriptor(value, "./plugins/invalid.cjs"),
      {
        message:
          'ttsc: plugin "./plugins/invalid.cjs" does not export a valid ttsc plugin',
      },
    );
  }
  const admitted = { name: "ordinary", source: sourceA };
  assert.equal(
    PluginDescriptorAdmission.descriptor(admitted, "./plugins/valid.cjs"),
    admitted,
  );
  for (const [stage, expected] of [
    [undefined, "transform"],
    ["transform", "transform"],
    ["check", "check"],
  ] as const) {
    assert.equal(
      PluginDescriptorAdmission.stage(
        PluginDescriptorAdmission.descriptor(
          { name: "ordinary", stage },
          "./plugins/valid.cjs",
        ),
      ),
      expected,
    );
  }
  assert.throws(
    () =>
      PluginDescriptorAdmission.stage(
        PluginDescriptorAdmission.descriptor(
          { name: "legacy", stage: "output" },
          "./plugins/legacy.cjs",
        ),
      ),
    {
      message:
        'ttsc: plugin "legacy" requested removed stage "output"; upgrade the plugin to a transform-stage descriptor compatible with this ttsc version',
    },
  );
  assert.throws(
    () =>
      PluginDescriptorAdmission.stage(
        PluginDescriptorAdmission.descriptor(
          { name: "unknown", stage: "other" },
          "./plugins/unknown.cjs",
        ),
      ),
    {
      message: 'ttsc: plugin "unknown" requested unsupported stage "other"',
    },
  );
  assert.deepEqual(admitted, { name: "ordinary", source: sourceA });

  const packageRoots = ["go-mod-file", "go-mod-directory", "go-mod-absent"].map(
    (name) => path.join(root, name),
  );
  for (const directory of packageRoots) fs.mkdirSync(directory);
  fs.writeFileSync(
    path.join(packageRoots[0]!, "go.mod"),
    "module example.com/rogue\n",
    "utf8",
  );
  fs.mkdirSync(path.join(packageRoots[1]!, "go.mod"));
  for (const directory of packageRoots.slice(0, 2)) {
    assert.throws(
      () =>
        SourcePluginAdmission.requireContributorPackage("host", {
          name: "rogue",
          source: directory,
        }),
      {
        message: `ttsc: plugin "host" contributor "rogue" must ship Go source as a package, not a module (go.mod found at ${directory}/go.mod). Remove go.mod so the contributor compiles inside the host module's dependency graph.`,
      },
    );
  }
  SourcePluginAdmission.requireContributorPackage("host", {
    name: "ordinary",
    source: packageRoots[2]!,
  });
  assert.equal(
    fs.readFileSync(path.join(packageRoots[0]!, "go.mod"), "utf8"),
    "module example.com/rogue\n",
  );
  assert.equal(
    fs.statSync(path.join(packageRoots[1]!, "go.mod")).isDirectory(),
    true,
  );
  assert.equal(fs.existsSync(path.join(packageRoots[2]!, "go.mod")), false);

  const includedCache = path.join(sourceA, "cache");
  const cacheError = (cache: string, source: string): string =>
    `ttsc: the cache ${cache} lies inside the plugin source ${source}, which the plugin's binary is keyed on, so every build would change the source it was keyed on. Place the cache outside the plugin's sources; the default one, in node_modules, already is.`;
  for (const cache of [sourceA, includedCache]) {
    assert.throws(
      () =>
        SourcePluginAdmission.requireCachesOutsideSources([cache], [sourceA]),
      { message: cacheError(cache, sourceA) },
    );
  }
  const admittedCaches = [
    path.join(sourceA, "node_modules", ".cache"),
    path.join(sourceA, ".git", "cache"),
    path.join(root, "contrib_a-sibling"),
  ];
  const cacheInputs = structuredClone(admittedCaches);
  SourcePluginAdmission.requireCachesOutsideSources(admittedCaches, [sourceA]);
  SourcePluginAdmission.requireCachesOutsideSources([], [sourceA]);
  SourcePluginAdmission.requireCachesOutsideSources([includedCache], []);
  assert.deepEqual(admittedCaches, cacheInputs);
  assert.throws(
    () =>
      SourcePluginAdmission.requireCachesOutsideSources(
        [includedCache, sourceB],
        [sourceB, sourceA],
      ),
    { message: cacheError(includedCache, sourceA) },
  );

  for (const [modulePath, expected] of [
    ["github.com/samchon/ttsc/packages/ttsc", true],
    ["github.com/microsoft/TypeScript/tsc", true],
    ["github.com/microsoft/TypeScript/tsc/shim/printer", true],
    ["github.com/microsoft/TypeScript/tsc/shim", false],
    ["github.com/microsoft/TypeScript/tsc-extra", false],
    ["github.com/microsoft/TypeScript", false],
    ["github.com/microsoft/typescript-go/shim/printer", true],
    ["github.com/microsoft/typescript-go/shim", false],
    ["github.com/microsoft/typescript-go", false],
    ["github.com/microsoft/typescript-go-extra", false],
    ["example.com/ordinary", false],
  ] as const)
    assert.equal(SourcePluginAdmission.isManagedModule(modulePath), expected);
  const overlays = new Set(["example.com/overlay"]);
  const ordinaryReplacements = [{ modulePath: "example.com/ordinary" }];
  SourcePluginAdmission.requireSourceReplacements(
    ordinaryReplacements,
    overlays,
    "host",
  );
  SourcePluginAdmission.requireSourceReplacements([], overlays, "host");
  for (const forbidden of [
    "github.com/microsoft/typescript-go/shim/printer",
    "github.com/microsoft/TypeScript/tsc/shim/printer",
    "example.com/overlay",
  ]) {
    const replacements = [
      ...ordinaryReplacements,
      { modulePath: forbidden },
      { modulePath: "github.com/microsoft/TypeScript/tsc" },
    ];
    assert.throws(
      () =>
        SourcePluginAdmission.requireSourceReplacements(
          replacements,
          overlays,
          "host",
        ),
      {
        message: `ttsc: plugin "host" go.mod replaces ttsc-managed module "${forbidden}". Remove this replace directive; ttsc supplies its own compiler and shim modules while building source plugins.`,
      },
    );
    assert.deepEqual(replacements, [
      { modulePath: "example.com/ordinary" },
      { modulePath: forbidden },
      { modulePath: "github.com/microsoft/TypeScript/tsc" },
    ]);
  }
  assert.deepEqual([...overlays], ["example.com/overlay"]);
}
