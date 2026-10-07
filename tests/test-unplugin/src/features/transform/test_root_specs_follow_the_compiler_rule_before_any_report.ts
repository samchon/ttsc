import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import { matchesProjectRootFile } from "../../../../../packages/unplugin/src/core/tsconfig/matchesProjectRootFile";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a membership policy no compile has reported for matches root specs
 * under the compiler's own case rule, not under `process.platform`.
 *
 * Before any compile, the Metro key, the referenced-project selection, and the
 * first walk took the policy from `process.platform === "linux"`, while
 * TypeScript-Go decides it from the executable it runs as, so on a volume whose
 * case behaviour differs from the platform's usual one they decided another
 * membership than the compiler (samchon/ttsc#1563). They now take the answer of
 * `compilerUsesCaseSensitiveFileNames`.
 *
 * 1. Read the policy of a project whose `include` is `src`, with a file under
 *    `Src/`.
 * 2. Ask whether `Src/a.ts` is a root file under native grammar and an explicitly
 *    supplied foreign-view grammar whose usual case answer differs.
 * 3. Assert both answers are the compiler rule's: a member exactly when the
 *    compiler compares names case-insensitively.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls readProjectMembershipPolicy and matchesProjectRootFile on an include src fixture containing Src/a.ts; native and explicitly supplied foreign-view grammar must use the same compiler case rule.
 * @evidence contracts/testing.md#independent-expectations compilerUsesCaseSensitiveFileNames is the authoritative compiler-facing policy, rather than the adapter matcher. This oracle detects platform guessing but shares the compiler policy approximation, so it cannot validate that approximation against the native compiler.
 * @evidence contracts/testing.md#distinguishing-cases Owns a spelling differing only by case and adversarial view grammar without a compile report. It distinguishes a matcher using view-platform case guesses; it cannot establish a different actual native volume's compiler rule.
 * @evidence contracts/testing.md#execution-ownership Unit test: calls authored readProjectMembershipPolicy and matchesProjectRootFile on a temporary Src project through the matcher's supported platform argument. No foreign global is changed and no compile report or native compiler runs.
 */
export function test_root_specs_follow_the_compiler_rule_before_any_report(): void {
  const root = TestProject.tmpdir("ttsc-root-case-rule-");
  fs.mkdirSync(path.join(root, "Src"), { recursive: true });
  fs.writeFileSync(path.join(root, "Src", "a.ts"), "export {};\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src"] }),
  );
  const expected = !compilerUsesCaseSensitiveFileNames({ projectRoot: root });
  const member = (platform: NodeJS.Platform = process.platform): boolean =>
    matchesProjectRootFile(
      path.join(root, "Src", "a.ts"),
      readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
      false,
      platform,
    );

  assert.equal(member(), expected);
  assert.equal(
    member(process.platform === "linux" ? "darwin" : "linux"),
    expected,
    "view grammar must not choose compiler case policy",
  );
}
