import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/ITtscProjectMembershipPolicy.js";
import { matchesProjectRootFile } from "../../../../../packages/unplugin/lib/core/tsconfig/matchesProjectRootFile.mjs";

/**
 * Verifies root specs match under the case policy the membership policy
 * carries, the compiler's, rather than the platform's.
 *
 * TypeScript-Go matches a project's `include` under the case policy of the
 * filesystem its executable lives on: a case-sensitive compiler admits
 * `d.MIN.js` through `src/*.js` while it leaves `d.min.js` out, and it keeps a
 * `Src` spec from matching a `src` directory. The adapter chose the policy from
 * `process.platform`, so on a case-sensitive macOS volume or a case-insensitive
 * Linux one it decided another membership than the compiler
 * (samchon/ttsc#1545).
 *
 * 1. Build one policy per case answer over `src/*.js` and `Src/*.ts`.
 * 2. Assert the sensitive policy admits `d.MIN.js`, refuses `d.min.js`, and
 *    refuses `src/a.ts` for `Src/*.ts`.
 * 3. Assert the insensitive policy refuses both `.min.js` spellings and admits
 *    `src/a.ts`.
 */
export function test_root_specs_match_under_the_compilers_case_policy(): void {
  const root = TestProject.tmpdir("ttsc-root-case-policy-");
  const policy = (
    useCaseSensitiveFileNames: boolean,
  ): ITtscProjectMembershipPolicy => ({
    excludedDirectories: [],
    inputExtensions: [".ts", ".js"],
    rootFileSpecs: {
      files: [],
      include: [path.join(root, "src", "*.js"), path.join(root, "Src", "*.ts")],
    },
    sources: [],
    useCaseSensitiveFileNames,
  });
  const file = (...parts: string[]): string => path.join(root, ...parts);

  const sensitive = policy(true);
  assert.equal(
    matchesProjectRootFile(file("src", "d.MIN.js"), sensitive, false),
    true,
    "a case-sensitive compiler admits d.MIN.js",
  );
  assert.equal(
    matchesProjectRootFile(file("src", "d.min.js"), sensitive, false),
    false,
  );
  assert.equal(
    matchesProjectRootFile(file("src", "a.ts"), sensitive, false),
    false,
    "Src does not name src",
  );

  const insensitive = policy(false);
  assert.equal(
    matchesProjectRootFile(file("src", "d.MIN.js"), insensitive, false),
    false,
    "a case-insensitive compiler folds .MIN.js",
  );
  assert.equal(
    matchesProjectRootFile(file("src", "d.min.js"), insensitive, false),
    false,
  );
  assert.equal(
    matchesProjectRootFile(file("src", "a.ts"), insensitive, false),
    true,
    "Src names src",
  );
}
