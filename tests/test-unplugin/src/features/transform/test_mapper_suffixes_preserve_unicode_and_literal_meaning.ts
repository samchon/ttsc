import assert from "node:assert/strict";
import path from "node:path";

import { selectReportedMembershipPolicy } from "../../../../../packages/unplugin/src/core/transform/generation/selectReportedMembershipPolicy";
import { isPossibleProgramFileName } from "../../../../../packages/unplugin/src/core/transform/project/isPossibleProgramFileName";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies mapper suffixes retain literal Unicode meaning across root policy.
 *
 * 1. Read authored Unicode and punctuation suffixes without changing spelling.
 * 2. Admit literal suffixes and simple case variants, rejecting expansion and
 *    wildcard lookalikes.
 * 3. Refuse a primed walk when suffix or output-directory meaning changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained config reader, filename predicate and native policy selector; catches lossy lowercasing, regex metacharacter interpretation and false policy equivalence while permitting ordinary case variants.
 * @evidence contracts/testing.md#independent-expectations Authored literal suffixes define spelling; Unicode simple case folding relates sigma and long s but never expands dotted I. Distinct authored output paths must require a new walk even when full lowercasing collides.
 * @evidence contracts/testing.md#distinguishing-cases Covers dotted I, contextual sigma, long s, supplementary-plane case, literal punctuation, trailing newline, empty extension lists, separate policy identities, ASCII equivalence and distinct Unicode root/output spellings. Native root enumeration belongs to the existing installed mapper scenario.
 * @evidence contracts/testing.md#execution-ownership The discoverable unit calls maintained portable policy operations over one temporary JSON project; it starts no compiler, mapper, watcher or installation.
 */
export function test_mapper_suffixes_preserve_unicode_and_literal_meaning(): void {
  const root = TestProject.tmpdir("ttsc-unicode-mapper-");
  const suffixes = [".İ", ".Σ", ".ΟΣ", ".s", ".𐐀", ".x+y", ".a[b]"];
  TestProject.writeFiles(root, {
    "tsconfig.json": JSON.stringify({
      contentMappers: [{ package: "mapper", extensions: suffixes }],
    }),
  });
  const read = readProjectMembershipPolicy(path.join(root, "tsconfig.json"));
  for (const suffix of suffixes)
    assert.ok(read.inputExtensions.includes(suffix), suffix);
  const policy = { ...read, inputExtensions: suffixes };
  for (const name of [
    "one.İ",
    "one.Σ",
    "one.ς",
    "one.ΟΣ",
    "one.ος",
    "one.ſ",
    "one.𐐨",
    "one.x+y",
    "one.a[b]",
  ])
    assert.equal(isPossibleProgramFileName(name, policy), true, name);
  for (const name of [
    "one.i",
    "one.i\u0307",
    "one.xxy",
    "one.ab",
    "one.s\n",
    "one.ts",
    "",
  ])
    assert.equal(isPossibleProgramFileName(name, policy), false, name);
  assert.equal(
    isPossibleProgramFileName("one.s", { ...policy, inputExtensions: [] }),
    false,
  );
  assert.equal(
    isPossibleProgramFileName("one.ts", {
      ...policy,
      inputExtensions: [".ts"],
    }),
    true,
  );

  const select = (
    beforeSuffix: string,
    afterSuffix: string,
    beforeRoot: string,
    beforeOut: string,
    afterOut: string,
  ) =>
    selectReportedMembershipPolicy(
      {
        ...read,
        useCaseSensitiveFileNames: false,
        inputExtensions: [beforeSuffix],
        rootFileSpecs: {
          ...read.rootFileSpecs!,
          root: { path: beforeRoot, realpath: beforeRoot },
        },
        excludedDirectories: [beforeOut],
      },
      {
        type: "success",
        typescript: {},
        graph: {
          edges: {},
          configs: [],
          globals: [],
          useCaseSensitiveFileNames: false,
          membership: {
            inputExtensions: [afterSuffix],
            outDir: afterOut,
            declarationDir: null,
          },
        },
      },
    ).membershipPolicyLearned;
  const out = path.join(root, "out");
  assert.equal(select(".SQL", ".sql", root, out, out), false);
  assert.equal(select(".İ", ".i\u0307", root, out, out), true);
  assert.equal(
    select(
      ".ts",
      ".ts",
      root,
      path.join(root, "outİ"),
      path.join(root, "outi\u0307"),
    ),
    true,
  );
  const unicodeRoot = path.join(root, "rootİ");
  assert.equal(
    select(
      ".ts",
      ".ts",
      unicodeRoot,
      path.join(unicodeRoot, "out"),
      path.join(root, "rooti\u0307", "out"),
    ),
    true,
  );
}
