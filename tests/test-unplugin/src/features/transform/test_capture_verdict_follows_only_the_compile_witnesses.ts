import assert from "node:assert/strict";
import path from "node:path";

import { createHostPathIdentityContext } from "../../../../../packages/unplugin/lib/core/transform/filesystem/createHostPathIdentityContext.mjs";
import { createGenerationProofFailures } from "../../../../../packages/unplugin/lib/core/transform/generation/createGenerationProofFailures.mjs";
import { projectWalkStable } from "../../../../../packages/unplugin/lib/core/transform/generation/projectWalkStable.mjs";
import { recordProjectSnapshotFailures } from "../../../../../packages/unplugin/lib/core/transform/generation/recordProjectSnapshotFailures.mjs";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";

/**
 * Verifies a capture's project verdict is decided by the evidence spanning the
 * compile alone (samchon/ttsc#1383).
 *
 * The verdict takes the walks before and after the compile and the one tracker
 * opened before it. The trackers opened after the compile cannot witness what
 * it read, and their events used to fail the attempt, so `vitest` writing its
 * cache under `node_modules` became a terminal capture error. Every other row
 * pins the evidence that must still fail it: a declared input that changed, a
 * directory that can hold a program input changing membership, an incomplete
 * walk, an unstable configuration, and a queued event on a declared input.
 *
 * 1. Decide the verdict for a baseline, and for each single change to it.
 * 2. Record the witnesses of a membership event, of an overflowing one, and of an
 *    attempt with no evidence at all.
 */
export async function test_capture_verdict_follows_only_the_compile_witnesses(): Promise<void> {
  const root = path.resolve("/project");
  const declared = new Set(["src/main.ts"]);
  const walk = (
    change: {
      complete?: boolean;
      directoryComplete?: boolean;
      fileSignatures?: Record<string, string>;
      hashes?: Record<string, string>;
      projectDirectories?: {
        path: string;
        relevant: boolean;
        signature: string;
      }[];
      unstableFiles?: string[];
    } = {},
  ) => ({
    complete: change.complete ?? true,
    directoryComplete: change.directoryComplete ?? true,
    fileSignatures: {
      "logs/build.log": "log-signature",
      "src/main.ts": "main-signature",
      ...change.fileSignatures,
    },
    hashes: {
      "logs/build.log": "log-hash",
      "src/main.ts": "main-hash",
      ...change.hashes,
    },
    notificationUnsafeInputs: new Set<string>(),
    projectDirectories: change.projectDirectories ?? [
      { path: path.join(root, "dist"), relevant: false, signature: "dist" },
      { path: path.join(root, "src"), relevant: true, signature: "src" },
    ],
    provenSignatures: {},
    unstableFiles: new Set(change.unstableFiles ?? []),
    walkFailures: [],
  });
  const tracker = (
    change: Partial<TtscProjectMutationTracker> = {},
  ): TtscProjectMutationTracker => ({
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    failed: false,
    membershipChanged: false,
    ...change,
  });
  const stable = (
    change: Partial<Parameters<typeof projectWalkStable>[0]> = {},
  ): boolean =>
    projectWalkStable({
      before: walk(),
      configStable: true,
      declared,
      projectRoot: root,
      snapshot: walk(),
      tracker: tracker(),
      ...change,
    });

  assert.equal(stable(), true, "an unchanged project holds still");
  assert.equal(
    stable({ tracker: undefined }),
    true,
    "a project without a watcher is decided by its walks",
  );
  assert.equal(stable({ configStable: false }), false);

  assert.equal(
    stable({ snapshot: walk({ hashes: { "src/main.ts": "edited" } }) }),
    false,
    "a declared input whose content changed",
  );
  assert.equal(
    stable({
      snapshot: walk({ fileSignatures: { "src/main.ts": "touched" } }),
    }),
    false,
    "a declared input whose metadata changed",
  );
  assert.equal(
    stable({ snapshot: walk({ hashes: { "logs/build.log": "appended" } }) }),
    true,
    "a file the compile never read",
  );
  assert.equal(
    stable({
      declared: undefined,
      snapshot: walk({ hashes: { "logs/build.log": "appended" } }),
    }),
    false,
    "an envelope that declares no input compares the whole walk",
  );

  assert.equal(
    stable({ snapshot: walk({ unstableFiles: ["logs/build.log"] }) }),
    true,
    "a file the compile never read failed its own read sandwich",
  );
  assert.equal(
    stable({ snapshot: walk({ unstableFiles: ["src/main.ts"] }) }),
    false,
  );
  assert.equal(
    stable({ before: walk({ directoryComplete: false }) }),
    false,
    "a directory the walk could not list",
  );
  assert.equal(
    stable({ declared: undefined, snapshot: walk({ complete: false }) }),
    false,
  );

  const directories = (dist: string, src: string) => [
    { path: path.join(root, "dist"), relevant: false, signature: dist },
    { path: path.join(root, "src"), relevant: true, signature: src },
  ];
  assert.equal(
    stable({
      snapshot: walk({ projectDirectories: directories("emitted", "src") }),
    }),
    true,
    "a directory that cannot hold a program input",
  );
  assert.equal(
    stable({
      snapshot: walk({ projectDirectories: directories("dist", "added") }),
    }),
    false,
    "a directory that can hold a program input changed membership",
  );

  assert.equal(
    stable({
      tracker: tracker({
        changes: new Set([
          path.join(root, "node_modules", ".vitest-cache", "032d12b6"),
        ]),
      }),
    }),
    true,
    "a write the compile never read, heard by the pre-compile tracker",
  );
  assert.equal(
    stable({
      tracker: tracker({
        changes: new Set([path.join(root, "src", "main.ts")]),
      }),
    }),
    false,
    "a queued event on a declared input is the A-B-A witness",
  );
  assert.equal(
    stable({ tracker: tracker({ changesOmitted: true }) }),
    false,
    "an overflowing witness bound cannot rule a declared input out",
  );
  assert.equal(
    stable({
      declared: undefined,
      tracker: tracker({ changes: new Set([path.join(root, "notes.md")]) }),
    }),
    false,
  );
  assert.equal(
    stable({ tracker: tracker({ membershipChanged: true }) }),
    false,
    "a membership event during the compile",
  );

  const identities = createHostPathIdentityContext();
  const witnesses = (event: TtscProjectMutationTracker | undefined) => {
    const failures = createGenerationProofFailures();
    recordProjectSnapshotFailures(failures, {
      before: walk(),
      declared,
      identities,
      projectRoot: root,
      snapshot: walk(),
      ...(event === undefined ? {} : { tracker: event }),
    });
    return failures;
  };
  const added = path.join(root, "src", "added.ts");
  assert.deepEqual(
    witnesses(tracker({ changes: new Set([added]), membershipChanged: true }))
      .entries,
    [{ domain: "project", kind: "project-membership-event", path: added }],
  );
  const overflowing = witnesses(
    tracker({
      changes: new Set([added]),
      changesOmitted: true,
      membershipChanged: true,
    }),
  );
  assert.equal(overflowing.omitted, 1, "the dropped witnesses are counted");
  assert.deepEqual(witnesses(undefined).entries, [
    { domain: "project", kind: "snapshot-incomplete", path: root },
  ]);
}
