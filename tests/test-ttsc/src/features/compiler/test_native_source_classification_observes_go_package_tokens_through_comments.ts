import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";
import { resolveNativeSource } from "../../../../../packages/ttsc/src/plugin/internal/load/resolveNativeSource";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies native source ownership follows Go package tokens through trivia.
 *
 * A line regex can choose a package-looking line inside a block comment or
 * truncate a Unicode library name to main. Both silently change whether the
 * native loader links a library or invokes a standalone compiler backend.
 *
 * 1. Resolve production Go files with leading/inter-token comments and BOM.
 * 2. Resolve Unicode identifiers including libraries beginning with main.
 * 3. Compare every actual ownership result with the authored Go package-clause
 *    expectations.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored resolveNativeSource for eighteen actual module/file layouts and checks complete ordered ownership results, including every failure rather than stopping at the first mismatch.
 * @evidence contracts/testing.md#independent-expectations Each case's expected kind is a literal derived from the Go package clause the file actually declares (comments and BOM skipped, Unicode letters and digits kept in the identifier), authored for the package-owned source fixtures; the actual Go toolchain selects the package rather than supplying the expected result.
 * @evidence contracts/testing.md#distinguishing-cases Owns plain main/library, fake package lines in comments in both directions, line/adjacent/inline/inter-token comments, leading BOM, underscore and Unicode letter/digit controls; test-only and missing-package rejection belong to the neighboring original classification unit.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit export imports the actual classifier directly and copies bounded package-owned source fixtures; it runs Go package metadata in generated workspaces without native producer builds or descriptor evaluation.
 */
export function test_native_source_classification_observes_go_package_tokens_through_comments(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("native-source-package-tokens-"),
  );
  const inputs: readonly [string, "executable" | "linked"][] = [
    ["plain-library", "linked"],
    ["plain-main", "executable"],
    ["block-fake-main", "linked"],
    ["block-fake-library", "executable"],
    ["line-comment", "linked"],
    ["inline-block", "linked"],
    ["multiline-block-spaces", "linked"],
    ["unicode-library", "linked"],
    ["inline-before-main", "executable"],
    ["between-keyword-main", "executable"],
    ["between-keyword-library", "linked"],
    ["multiline-between-keyword", "linked"],
    ["adjacent-block-comments", "linked"],
    ["bom-library", "linked"],
    ["line-before-main", "executable"],
    ["unicode-tail", "linked"],
    ["unicode-digit", "linked"],
    ["underscore", "linked"],
  ];
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "native_source_classification_observes_go_package_tokens_through_comments",
      "inputs-1",
    ),
    root,
  );
  for (const [id] of inputs)
    fs.renameSync(
      path.join(root, id, "main.go.txt"),
      path.join(root, id, "main.go"),
    );
  const observations = NativeSourcePackages.ownPackages(inputs.map(([id]) => ({
    source: path.join(root, id), label: id,
  })), process.env);
  const actual = inputs.map(([id], index) => {
    const source = path.join(root, id);
    try {
      const resolved = resolveNativeSource(
        source,
        { source, name: id },
        { transform: id },
        0,
        { observation: observations[index]! },
      );
      return { id, kind: resolved.kind, moduleRoot: resolved.moduleRoot };
    } catch (error) {
      return {
        id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  assert.deepEqual(
    actual,
    inputs.map(([id, kind]) => ({ id, kind, moduleRoot: path.join(root, id) })),
  );
}
