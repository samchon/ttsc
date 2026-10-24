import assert from "node:assert/strict";
import path from "node:path";

import { selectReportedMembershipPolicy } from "../../../../../packages/unplugin/src/core/transform/generation/selectReportedMembershipPolicy";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies config primers and effective native root reports have separate
 * authority.
 *
 * 1. Read inherited mapper extensions and implicit checkJs admission.
 * 2. Contrast clearing declarations and explicit allowJs false.
 * 3. Replace suffixes and implicit output exclusions from a native report.
 * 4. Compare root aliases without collapsing unrelated child-link spellings.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual config reading inherits mapper suffixes and checkJs semantics; native selection replaces suffix/output settings, preserves explicit excludes and refuses a differently primed walk without mutating the primer.
 * @evidence contracts/testing.md#independent-expectations Literal suffix sets, output directories and learned booleans distinguish authored config from effective CLI settings; root aliases and child aliases have independently authored equality expectations.
 * @evidence contracts/testing.md#distinguishing-cases Covers inherited, empty and malformed mapper declarations, allowJs false overriding checkJs, suffix order equivalence, native null clearing, explicit excludes, root aliases and distinct lexical child paths.
 * @evidence contracts/testing.md#execution-ownership This named unit uses one temporary JSON project and the maintained reader/selector directly; no compiler, watcher or installation is started to test settings projection.
 */
export function test_native_membership_reports_replace_provisional_roots(): void {
  const root = TestProject.tmpdir("ttsc-mapper-membership-");
  const read = (config: object) => {
    TestProject.writeFiles(root, {
      "base.json": JSON.stringify({
        contentMappers: [
          { package: "mapper", extensions: [".SQL", ".vue", ".sql"] },
        ],
        compilerOptions: { checkJs: true, outDir: "old" },
      }),
      "tsconfig.json": JSON.stringify({ extends: "./base.json", ...config }),
    });
    return readProjectMembershipPolicy(path.join(root, "tsconfig.json"));
  };
  const inherited = read({});
  assert.equal(
    inherited.inputExtensions.filter((value) => value === ".sql").length,
    1,
  );
  assert.ok(inherited.inputExtensions.includes(".vue"));
  assert.ok(inherited.inputExtensions.includes(".js"));
  for (const contentMappers of [[], null, false]) {
    const cleared = read({
      contentMappers,
      compilerOptions: { allowJs: false },
    });
    assert.ok(!cleared.inputExtensions.includes(".sql"));
    assert.ok(!cleared.inputExtensions.includes(".js"));
  }
  const primed = { ...inherited, useCaseSensitiveFileNames: true };
  const before = structuredClone(primed);
  const select = (
    inputExtensions: string[],
    outDir: string | null,
    declarationDir: string | null = null,
  ) =>
    selectReportedMembershipPolicy(primed, {
      type: "success",
      typescript: {},
      graph: {
        edges: {},
        globals: [],
        configs: [],
        membership: { inputExtensions, outDir, declarationDir },
      },
    });
  assert.equal(
    select([...primed.inputExtensions].reverse(), path.join(root, "old"))
      .membershipPolicyLearned,
    false,
  );
  const changed = select(
    [".ts", ".json"],
    path.join(root, "new"),
    path.join(root, "declarations"),
  );
  assert.equal(changed.membershipPolicyLearned, true);
  assert.deepEqual(changed.membershipPolicy.inputExtensions, [".ts", ".json"]);
  assert.deepEqual(
    new Set(changed.membershipPolicy.excludedDirectories),
    new Set([path.join(root, "new"), path.join(root, "declarations")]),
  );
  assert.deepEqual(
    select([".ts"], null).membershipPolicy.excludedDirectories,
    [],
  );
  assert.deepEqual(primed, before);
  const explicit = {
    ...read({ exclude: ["vendor"] }),
    useCaseSensitiveFileNames: true,
  };
  const selected = selectReportedMembershipPolicy(explicit, {
    type: "success",
    typescript: {},
    graph: {
      edges: {},
      configs: [],
      globals: [],
      membership: {
        inputExtensions: [".ts"],
        outDir: path.join(root, "new"),
        declarationDir: null,
      },
    },
  });
  assert.deepEqual(selected.membershipPolicy.excludedDirectories, [
    path.join(root, "vendor"),
  ]);
  const alias = path.resolve(root, "../compiler-root-alias");
  const aliasPrimer = {
    ...primed,
    rootFileSpecs: {
      ...primed.rootFileSpecs!,
      root: { path: root, realpath: alias },
    },
  };
  const report = (outDir: string) => ({
    type: "success" as const,
    typescript: {},
    graph: {
      edges: {},
      globals: [],
      configs: [],
      membership: {
        inputExtensions: [...primed.inputExtensions],
        outDir,
        declarationDir: null,
      },
    },
  });
  assert.equal(
    selectReportedMembershipPolicy(aliasPrimer, report(path.join(alias, "old")))
      .membershipPolicyLearned,
    false,
  );
  assert.equal(
    selectReportedMembershipPolicy(
      aliasPrimer,
      report(path.join(alias, "child-alias")),
    ).membershipPolicyLearned,
    true,
  );
}
