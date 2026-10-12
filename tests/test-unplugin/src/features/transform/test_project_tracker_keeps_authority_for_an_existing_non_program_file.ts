import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies an edit to an existing non-program file in a walk directory keeps
 * the project tracker's authority, while names that could reach a program
 * member stay conservative (samchon/ttsc#1737).
 *
 * A stylesheet or an asset beside the sources is not a program member under any
 * spelling: a directory alias can move a file into the program but cannot
 * rename it. Withdrawing authority for each such edit sent the next delivery to
 * the whole-snapshot proof on every platform.
 *
 * 1. Plant sources, a stylesheet, a hard-linked stylesheet and a removed
 *    stylesheet in the source directory, and on POSIX a stylesheet link.
 * 2. Deliver an event for each through the tracker's watch callback, each on a
 *    fresh tracker.
 * 3. Assert only the plain stylesheet keeps the authority, and none records a
 *    membership mutation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual project tracker classifies events delivered through its watch seam over real files under a real tsconfig policy.
 * @evidence contracts/testing.md#independent-expectations Real file creation, a real hard link, a real removal and a real link set which names can reach a program member; literal unverified values are the expectations.
 * @evidence contracts/testing.md#distinguishing-cases A plain non-program file, a second hard link, a removed name and a link are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: real createProjectMutationTracker over a temporary project with a supplied watch callback; no native watcher, broker or compiler runs.
 */
export async function test_project_tracker_keeps_authority_for_an_existing_non_program_file(): Promise<void> {
  const root = TestProject.createProject({
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": "export const value = 1;\n",
    "src/styles.css": "body {}\n",
    "src/linked.css": "a {}\n",
    "src/removed.css": "p {}\n",
  });
  const source = path.join(root, "src");
  fs.linkSync(path.join(source, "linked.css"), path.join(source, "second.css"));
  fs.rmSync(path.join(source, "removed.css"));
  const rows: [string, string, boolean][] = [
    ["change", "src/styles.css", true],
    ["change", "src/second.css", false],
    ["rename", "src/removed.css", false],
  ];
  if (process.platform !== "win32") {
    fs.symlinkSync(
      path.join(source, "styles.css"),
      path.join(source, "alias.css"),
    );
    rows.push(["change", "src/alias.css", false]);
  }
  const policy = readProjectMembershipPolicy(path.join(root, "tsconfig.json"));
  for (const [event, name, kept] of rows) {
    let notify:
      | ((eventType: string, filename: string | null) => void)
      | undefined;
    const tracker = await createProjectMutationTracker(
      [
        { path: root, relevant: true, signature: "authored-root" },
        { path: source, relevant: true, signature: "authored-source" },
      ],
      new Set([path.join(source, "main.ts")]),
      {
        ...DEFAULT_FILESYSTEM_OPERATIONS,
        watch: (_directory, listener) => {
          notify = listener;
          return { close: () => undefined };
        },
      },
      policy,
    );
    try {
      assert.equal(tracker.failed, false, name);
      assert.ok(notify);
      notify(event, name);
      assert.equal(
        tracker.unverified,
        kept ? undefined : true,
        `${event} ${name}: authority`,
      );
      assert.equal(tracker.membershipChanged, false, `${event} ${name}`);
    } finally {
      tracker.close();
    }
  }
}
