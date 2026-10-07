import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { projectWalkStable } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkStable";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { isProjectWalkPath } from "../../../../../packages/unplugin/src/core/transform/project/isProjectWalkPath";
import { reportsProgramMembership } from "../../../../../packages/unplugin/src/core/transform/project/reportsProgramMembership";
import { walkProjectInputs } from "../../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/src/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the walk, the walk predicate, and the tracker's membership predicate
 * give one answer for every path, under a readable policy and the permissive
 * fallback.
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
 * 2. Walk the project, and ask the walk predicate (`isProjectWalkPath`) and the
 *    membership predicate the trackers use (`reportsProgramMembership`) about
 *    every planted file, under a default-include policy with a literal `files`
 *    entry and under the permissive fallback.
 * 3. Assert all three agree with an authored expected list per policy, so tool
 *    output under ignored names is never membership.
 * 4. Deliver recursive content callbacks through the real tracker: excluded
 *    generated writes do not refute whole-walk stability, while admitted input
 *    A-B-A, a native alias, missing ancestry and unknown/overflow stay visible.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual walk, isProjectWalkPath and reportsProgramMembership select the independently specified planted corpus under readable policy and permissive fallback. The actual recursive tracker callback records admitted content and native aliases, excludes only proven out-of-walk content, retains unknown/overflow, and feeds the real whole-walk stability verdict.
 * @evidence contracts/testing.md#independent-expectations Two literal expected file populations define ordinary source, explicitly pinned package input and fallback hidden-path admission independently of all three product operations. Those same literal populations define callback content expectations; actual changed/restored source bytes, an authored directory link, absent ancestors and null notifications independently distinguish required witnesses from excluded generation output.
 * @evidence contracts/testing.md#distinguishing-cases Every planted source/package/hidden/tool file is checked positively or negatively under both policies, while exact walk populations prevent three identically incorrect predicates from certifying each other.
 * @evidence contracts/testing.md#execution-ownership Unit test: calls the real walkProjectInputs, isProjectWalkPath, reportsProgramMembership, tracker constructor and projectWalkStable over one native temporary corpus per policy. A supplied watch callback exercises the maintained recursive classification seam and closes once; it does not claim real backend notification authority. No compiler, broker process or E2E launcher is opened.
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
  const aliasDirectory = path.join(root, "node_modules", "event-alias");
  fs.symlinkSync(
    path.join(root, "src"),
    aliasDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
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

    const before = collectProjectInputSnapshot(
      root,
      createHostPathIdentityContext(),
      DEFAULT_FILESYSTEM_OPERATIONS,
      undefined,
      { policy },
    );
    let notify:
      | ((eventType: string, filename: string | null) => void)
      | undefined;
    let closed = 0;
    const tracker = await createProjectMutationTracker(
      before.projectDirectories,
      new Set(expected.map((file) => path.join(root, file))),
      {
        ...DEFAULT_FILESYSTEM_OPERATIONS,
        watch: (directory, listener) => {
          assert.equal(directory, root);
          notify = listener;
          return { close: () => { ++closed; } };
        },
      },
      policy,
    );
    try {
      assert.equal(tracker.failed, false);
      assert.equal(tracker.contentAuthoritative, false);
      const emit = notify;
      assert.ok(emit);
      for (const relative of planted.filter((file) => !expected.includes(file))) {
        const file = path.join(root, relative);
        const bytes = fs.readFileSync(file);
        fs.writeFileSync(file, "export const generated = 2;\n");
        emit("change", relative);
        fs.writeFileSync(file, bytes);
        assert.equal(tracker.changes.has(file), false, label + ": " + relative);
      }
      assert.equal(tracker.unverified, true, "lexical rejection still withdraws authority");
      const after = collectProjectInputSnapshot(
        root,
        createHostPathIdentityContext(),
        DEFAULT_FILESYSTEM_OPERATIONS,
        undefined,
        { policy },
      );
      assert.equal(
        projectWalkStable({
          before, snapshot: after, configStable: true,
          declared: undefined, projectRoot: root, tracker,
        }),
        true,
        "excluded recursive content does not refute the whole failure walk",
      );
      const source = path.join(root, "src/main.ts");
      const original = fs.readFileSync(source);
      fs.writeFileSync(source, "export const value = 2;\n");
      emit("change", "src/main.ts");
      fs.writeFileSync(source, original);
      assert.equal(tracker.changes.has(source), true, "admitted A-B-A stays recorded");
      const alias = path.join(aliasDirectory, "main.ts");
      emit("change", path.relative(root, alias));
      assert.equal(tracker.changes.has(alias), true, "excluded spelling cannot hide a native input alias");
      const absent = path.join(root, "unobserved", "missing", "input.ts");
      emit("change", path.relative(root, absent));
      assert.equal(tracker.changes.has(absent), true, "missing ancestry remains conservative");
      for (let index = 0; index < 12; index++)
        emit("change", path.join("unobserved", `unknown-${index}.ts`));
      assert.equal(tracker.changesOmitted, true, "overflow still refutes silence");
      emit("rename", null);
      assert.equal(tracker.membershipChanged, true, "unknown notification remains structural");
      assert.equal(
        projectWalkStable({
          before, snapshot: after, configStable: true,
          declared: undefined, projectRoot: root, tracker,
        }),
        false,
        "input and unknown/overflow witnesses still refute whole-walk stability",
      );
    } finally {
      tracker.close();
    }
    assert.equal(closed, 1);
  }
}
