import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import { matchesProjectRootFile } from "../../../../../packages/unplugin/src/core/tsconfig/matchesProjectRootFile";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

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
 * 2. Ask whether `Src/a.ts` is a root file, once as the platform is and once while
 *    `process.platform` names a platform whose ordinary answer is the other
 *    one.
 * 3. Assert both answers are the compiler rule's: a member exactly when the
 *    compiler compares names case-insensitively.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls readProjectMembershipPolicy and matchesProjectRootFile on an include src fixture containing Src/a.ts; asserts membership equals the compiler case rule before and after overriding process.platform.
 * @evidence contracts/testing.md#independent-expectations compilerUsesCaseSensitiveFileNames is the authoritative compiler-facing policy, rather than the adapter matcher. This oracle detects platform guessing but shares the compiler policy approximation, so it cannot validate that approximation against the native compiler.
 * @evidence contracts/testing.md#distinguishing-cases Owns a spelling differing only by case and an adversarial platform value without a compile report. The original platform descriptor is restored in finally; native case-volume equivalence is outside this case.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_root_specs_follow_the_compiler_rule_before_any_report is discovered under src/features/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
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
  const member = (): boolean =>
    matchesProjectRootFile(
      path.join(root, "Src", "a.ts"),
      readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
      false,
    );

  assert.equal(member(), expected);
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", {
    ...platform,
    value: process.platform === "linux" ? "darwin" : "linux",
  });
  let overridden: boolean;
  try {
    overridden = member();
  } finally {
    Object.defineProperty(process, "platform", platform);
  }
  assert.equal(overridden, expected, "membership followed process.platform");
}
