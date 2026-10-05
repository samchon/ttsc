import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a project tracker cannot retain silence authority for an observed
 * native alias excluded only by the lexical root-file spelling.
 *
 * The supported filesystem view supplies a literal alias relationship and watch
 * callback. It models naming uncertainty rather than creating a native short
 * name or claiming that an injected watch proves content unchanged.
 *
 * 1. Plant a project admitting only LongConfig.ts and supply exact native
 *    observations mapping SHORT~1.TS to that same file.
 * 2. Delete that file, then emit its old short spelling through the actual
 *    project's watch listener; current realpath cannot recover the
 *    relationship.
 * 3. Require verification authority to be withdrawn without asserting a definite
 *    membership mutation, then close the acquired watcher once.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual project-tracker constructor receives an alias rename through its supported watch callback and must withdraw notification authority instead of treating a lexical root-file mismatch as proof of irrelevance.
 * @evidence contracts/testing.md#independent-expectations The authored filesystem maps two literal names to one planted file, then deletion makes both absent before the notification. Literal unverified=true follows lost native-name certainty; content authority is explicitly false and no recorded generation is patched to manufacture it.
 * @evidence contracts/testing.md#distinguishing-cases A known admitted file has healthy initial coverage, while its differently spelled native alias must require reproof. Authority withdrawal is distinct from a fabricated positive membership mutation; exact closure count rejects leaked watches.
 * @evidence contracts/testing.md#execution-ownership A source unit calls createProjectMutationTracker against real temporary metadata with explicit alias lstat/realpath and watcher seams. It runs no compiler, producer binary, real watch backend or short-name management tool.
 */
export async function test_project_tracker_withdraws_authority_for_native_alias_events(): Promise<void> {
  const root = TestProject.createProject({
    "tsconfig.json": '{"files":["LongConfig.ts"],"include":[]}',
    "LongConfig.ts": "export const value = 1;\n",
  });
  const file = path.join(root, "LongConfig.ts");
  const alias = path.join(root, "SHORT~1.TS");
  let notify:
    | ((eventType: string, filename: string | null) => void)
    | undefined;
  let closed = 0;
  const resolve = (location: string): string =>
    location === alias ? file : location;
  const tracker = await createProjectMutationTracker(
    [{ path: root, relevant: true, signature: "authored-directory-input" }],
    new Set([file]),
    {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      caseSensitive: () => false,
      exists: (location) => fs.existsSync(resolve(location)),
      lstat: (location) => fs.lstatSync(resolve(location), { bigint: true }),
      realpath: (location) => fs.realpathSync.native(resolve(location)),
      readFile: (location) => fs.readFileSync(resolve(location)),
      stat: (location) => fs.statSync(resolve(location)),
      statBigInt: (location) =>
        fs.statSync(resolve(location), { bigint: true }),
      watch: (_directory, listener) => {
        notify = listener;
        return {
          close: () => {
            ++closed;
          },
        };
      },
    },
    readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
  );
  try {
    assert.equal(tracker.failed, false);
    assert.equal(tracker.contentAuthoritative, false);
    assert.equal(tracker.membershipChanged, false);
    assert.equal(tracker.unverified, undefined);
    assert.ok(notify);
    fs.rmSync(file);
    notify("rename", "SHORT~1.TS");
    assert.equal(tracker.unverified, true);
    assert.equal(tracker.membershipChanged, false);
  } finally {
    tracker.close();
  }
  assert.equal(closed, 1);
}
