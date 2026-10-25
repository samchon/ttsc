import assert from "node:assert/strict";
import path from "node:path";

import { primeCompilerMembership } from "../../../../../packages/unplugin/src/core/transform/generation/primeCompilerMembership";
import { mergeMembershipPolicyOverlay } from "../../../../../packages/unplugin/src/core/tsconfig/mergeMembershipPolicyOverlay";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies provisional root settings follow compiler defaults and config
 * changes.
 *
 * 1. Read effective JSON and JavaScript admission across module defaults.
 * 2. Clear inherited options with null and recompute overlay defaults.
 * 3. Preserve mapper suffixes and legacy policy admission.
 * 4. Apply a learned hint only to its original config-policy premise.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual config reading and overlays predict built-in suffix admission, retain explicit false and null clearing, and prevent an old native report from replacing newly read settings.
 * @evidence contracts/testing.md#independent-expectations Boolean matrices follow pinned upstream GetResolveJsonModule/GetModuleResolutionKind/GetAllowJS semantics, independently verified by native probes; authored old/new directories define hint validity.
 * @evidence contracts/testing.md#distinguishing-cases Covers default, Node16/18/20/Next, modern and legacy resolution labels, explicit JSON flags, checkJs overridden by allowJs, inherited null clearing, mapper suffix collisions, legacy policies and changed extension/output premises.
 * @evidence contracts/testing.md#execution-ownership The discoverable unit calls maintained readers and projections in one temporary JSON project, without native compilation, installation, process or watcher work.
 */
export function test_membership_primers_preserve_native_option_defaults(): void {
  const root = TestProject.tmpdir("ttsc-membership-defaults-");
  const read = (compilerOptions: object, base: object = {}) => {
    TestProject.writeFiles(root, {
      "base.json": JSON.stringify({ compilerOptions: base }),
      "tsconfig.json": JSON.stringify({
        extends: "./base.json",
        compilerOptions,
      }),
    });
    return readProjectMembershipPolicy(path.join(root, "tsconfig.json"));
  };
  const cases: [Record<string, unknown>, boolean][] = [
    [{}, true],
    [{ module: "commonjs" }, true],
    [{ module: "node16" }, false],
    [{ module: "Node18" }, false],
    [{ module: "node20" }, true],
    [{ module: "nodenext" }, true],
    [{ moduleResolution: "node16" }, false],
    [{ moduleResolution: "nodenext" }, false],
    [{ moduleResolution: "bundler", module: "node16" }, true],
    [{ moduleResolution: "classic" }, true],
    [{ moduleResolution: "node" }, true],
    [{ moduleResolution: "node10" }, true],
    [{ module: "node20", moduleResolution: "node16" }, true],
    [{ module: "node16", resolveJsonModule: true }, true],
    [{ resolveJsonModule: false }, false],
  ];
  for (const [options, expected] of cases) {
    assert.equal(
      read(options).inputExtensions.includes(".json"),
      expected,
      JSON.stringify(options),
    );
    assert.equal(
      mergeMembershipPolicyOverlay(
        read({}),
        options,
        root,
      ).inputExtensions.includes(".json"),
      expected,
    );
  }
  for (const option of ["allowJs", "checkJs"])
    assert.equal(
      read({ [option]: null }, { [option]: true }).inputExtensions.includes(
        ".js",
      ),
      false,
    );
  assert.equal(
    read(
      { resolveJsonModule: null },
      { resolveJsonModule: false },
    ).inputExtensions.includes(".json"),
    true,
  );
  assert.equal(
    read(
      { module: null, moduleResolution: null },
      { module: "node16", moduleResolution: "node16" },
    ).inputExtensions.includes(".json"),
    true,
  );
  const checked = read({ checkJs: true });
  assert.ok(checked.inputExtensions.includes(".js"));
  assert.equal(
    mergeMembershipPolicyOverlay(
      checked,
      { allowJs: false },
      root,
    ).inputExtensions.includes(".js"),
    false,
  );
  assert.equal(
    mergeMembershipPolicyOverlay(
      read({ allowJs: false, checkJs: true }),
      { allowJs: null },
      root,
    ).inputExtensions.includes(".js"),
    true,
  );
  assert.equal(
    mergeMembershipPolicyOverlay(
      read({ resolveJsonModule: false }),
      { resolveJsonModule: null },
      root,
    ).inputExtensions.includes(".json"),
    true,
  );
  assert.equal(
    mergeMembershipPolicyOverlay(
      read({ module: "node16" }),
      { module: null },
      root,
    ).inputExtensions.includes(".json"),
    true,
  );
  const mapper = {
    ...read({}),
    extensionOptionOrigins: { mapperExtensions: [".sql", ".js", ".json"] },
  };
  const projected = mergeMembershipPolicyOverlay(
    mapper,
    { allowJs: false, resolveJsonModule: false },
    root,
  );
  for (const suffix of [".sql", ".js", ".json"])
    assert.ok(projected.inputExtensions.includes(suffix));
  const legacy = {
    excludedDirectories: [],
    inputExtensions: [".ts", ".json"],
    sources: [],
  };
  assert.deepEqual(
    mergeMembershipPolicyOverlay(legacy, {}, root).inputExtensions,
    legacy.inputExtensions,
  );
  assert.deepEqual(
    mergeMembershipPolicyOverlay(legacy, { resolveJsonModule: false }, root)
      .inputExtensions,
    [".ts"],
  );
  const original = read({ outDir: "old" });
  const basis = primeCompilerMembership(original).basis;
  const hint = {
    basis,
    report: {
      inputExtensions: [".ts", ".sql"],
      outDir: path.join(root, "cli"),
      declarationDir: null,
    },
  };
  assert.deepEqual(
    primeCompilerMembership(original, hint).policy.inputExtensions,
    [".ts", ".sql"],
  );
  for (const options of [
    { outDir: "new" },
    { outDir: "old", resolveJsonModule: false },
  ]) {
    const changed = read(options);
    const primed = primeCompilerMembership(changed, hint);
    assert.notEqual(primed.basis, basis);
    assert.equal(primed.policy, changed);
  }
}
