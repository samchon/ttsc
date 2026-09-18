import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { isProjectWalkPath } from "../../../../../packages/unplugin/lib/core/transform/project/isProjectWalkPath.mjs";
import { reportsProgramMembership } from "../../../../../packages/unplugin/lib/core/transform/project/reportsProgramMembership.mjs";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/ITtscProjectMembershipPolicy.mjs";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/lib/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

/**
 * Verifies the walk, the walk predicate, and the live tracker give one answer
 * for every path, under a readable policy and the permissive fallback.
 *
 * The live tracker never consulted the walk's ignored names, so under a policy
 * that admitted everything, creating `node_modules/.vite-temp` or writing
 * `node_modules/.prisma/client/index.d.ts` was a membership event the walk
 * could never see (samchon/ttsc#1385). The three now share one rule: a readable
 * policy decides through TypeScript-Go's root-file selection, which reaches a
 * package or hidden directory only when a spec names it literally, and only a
 * config that cannot be read falls back to the name list.
 *
 * 1. Plant sources in ordinary, package, hidden, and literally included
 *    directories.
 * 2. Walk the project, and ask the walk predicate and the tracker about every
 *    planted file, under a default-include policy with a literal `files` entry
 *    and under the permissive fallback.
 * 3. Assert all three agree, and tool output under ignored names is never
 *    membership.
 */
export async function test_membership_walk_predicate_and_tracker_agree_on_ignored_paths(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unplugin-membership-agree-");
  const planted = [
    "src/main.ts",
    "src/feature/view.ts",
    "node_modules/.vite-temp/vite.config.ts",
    "node_modules/.prisma/client/index.d.ts",
    "node_modules/pinned/index.ts",
    ".cache/output.ts",
    ".git/hooks/hook.ts",
    ".ttsc/plugin.ts",
  ];
  TestProject.writeFiles(root, {
    ...Object.fromEntries(
      planted.map((file) => [file, "export const value = 1;\n"]),
    ),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {},
      files: ["node_modules/pinned/index.ts"],
      include: ["src"],
    }),
  });
  const readable = readProjectMembershipPolicy(
    path.join(root, "tsconfig.json"),
  );
  const expectations = new Map<ITtscProjectMembershipPolicy, string[]>([
    [
      readable,
      ["src/main.ts", "src/feature/view.ts", "node_modules/pinned/index.ts"],
    ],
    // Without a readable config only the name list bounds the walk, so a
    // hidden directory it does not name is still walked.
    [
      PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
      ["src/main.ts", "src/feature/view.ts", ".cache/output.ts"],
    ],
  ]);

  for (const [policy, expected] of expectations) {
    const label =
      policy === readable ? "readable policy" : "permissive fallback";
    const walked = walkProjectInputs(
      root,
      DEFAULT_FILESYSTEM_OPERATIONS,
      policy,
    )
      .files.map((file: string) =>
        path.relative(root, file).replace(/\\/g, "/"),
      )
      .filter((file: string) => file.endsWith(".ts"))
      .sort();
    assert.deepEqual(walked, [...expected].sort(), `${label}: the walk`);
    for (const relative of planted) {
      const file = path.join(root, relative);
      const inWalk = expected.includes(relative);
      assert.equal(
        isProjectWalkPath(
          root,
          file,
          undefined,
          DEFAULT_FILESYSTEM_OPERATIONS,
          policy,
        ),
        inWalk,
        `${label}: the walk predicate for ${relative}`,
      );
      assert.equal(
        reportsProgramMembership(
          root,
          file,
          path.basename(file),
          policy,
          DEFAULT_FILESYSTEM_OPERATIONS,
        ),
        inWalk,
        `${label}: the tracker for ${relative}`,
      );
    }
  }
}
