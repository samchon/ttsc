import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TestProject } from "../../../../utils/src/TestProject";
import { resolveNativeSource } from "../../../../../packages/ttsc/src/plugin/internal/load/resolveNativeSource";

/**
 * Verifies native source ownership follows Go package tokens through trivia.
 *
 * A line regex can choose a package-looking line inside a block comment or
 * truncate a Unicode library name to main. Both silently change whether the
 * native loader links a library or invokes a standalone compiler backend.
 *
 * 1. Resolve production Go files with leading/inter-token comments and BOM.
 * 2. Resolve Unicode identifiers including libraries beginning with main.
 * 3. Compare every actual ownership result with the independently parsed Go names.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored resolveNativeSource for eighteen actual module/file layouts and checks complete ordered ownership results, including every failure rather than stopping at the first mismatch.
 * @evidence contracts/testing.md#independent-expectations Literal Go package tokens establish the expected main-versus-library kind; the same eighteen valid inputs were independently accepted and named by Go list, and Go scanner letter/digit rules require the full Unicode identifier.
 * @evidence contracts/testing.md#distinguishing-cases Owns plain main/library, fake package lines in comments in both directions, line/adjacent/inline/inter-token comments, leading BOM, underscore and Unicode letter/digit controls; test-only and missing-package rejection belong to the neighboring original classification unit.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit export imports the actual classifier directly and creates bounded source filesystem fixtures; it does not build native producers, evaluate descriptors or spawn Go during unit execution.
 */
export function test_native_source_classification_observes_go_package_tokens_through_comments(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("native-source-package-tokens-"));
  const inputs: readonly [string, string, "executable" | "linked"][] = [
    ["plain-library", "package actualplugin\n", "linked"],
    ["plain-main", "package main\nfunc main() {}\n", "executable"],
    ["block-fake-main", "/*\npackage main\n*/\npackage actualplugin\n", "linked"],
    ["block-fake-library", "/*\npackage actualplugin\n*/\npackage main\nfunc main() {}\n", "executable"],
    ["line-comment", "// package main\npackage actualplugin\n", "linked"],
    ["inline-block", "/* package main */ package actualplugin\n", "linked"],
    ["multiline-block-spaces", "/*\n   package main\n*/\npackage actualplugin\n", "linked"],
    ["unicode-library", "package \u63d2\u4ef6\n", "linked"],
    ["inline-before-main", "/* package actualplugin */ package main\nfunc main() {}\n", "executable"],
    ["between-keyword-main", "package /* docs */ main\nfunc main() {}\n", "executable"],
    ["between-keyword-library", "package /* docs */ actualplugin\n", "linked"],
    ["multiline-between-keyword", "package /*\n docs\n */ actualplugin\n", "linked"],
    ["adjacent-block-comments", "/* package main *//* package main */\npackage actualplugin\n", "linked"],
    ["bom-library", "\ufeffpackage actualplugin\n", "linked"],
    ["line-before-main", "// package actualplugin\npackage main\nfunc main() {}\n", "executable"],
    ["unicode-tail", "package main\u754c\n", "linked"],
    ["unicode-digit", "package main\u0661\n", "linked"],
    ["underscore", "package _library\n", "linked"],
  ];
  const actual = inputs.map(([id, text]) => {
    const source = path.join(root, id);
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "go.mod"), "module example.com/" + id + "\n\ngo 1.26\n");
    fs.writeFileSync(path.join(source, "main.go"), text);
    try {
      const resolved = resolveNativeSource(source, { source, name: id }, { transform: id }, 0);
      return { id, kind: resolved.kind, moduleRoot: resolved.moduleRoot };
    } catch (error) {
      return { id, error: error instanceof Error ? error.message : String(error) };
    }
  });
  assert.deepEqual(actual, inputs.map(([id, , kind]) => ({ id, kind, moduleRoot: path.join(root, id) })));
}
