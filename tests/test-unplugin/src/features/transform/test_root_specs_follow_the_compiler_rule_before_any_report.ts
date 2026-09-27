import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import { matchesProjectRootFile } from "../../../../../packages/unplugin/lib/core/tsconfig/matchesProjectRootFile.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.js";

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
