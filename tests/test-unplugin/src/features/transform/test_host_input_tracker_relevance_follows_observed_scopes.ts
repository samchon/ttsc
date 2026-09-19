import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTrackedInputScope } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscTrackedInputScope.mjs";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";

/**
 * Verifies the host-input tracker records exactly the events that can change
 * what the compiler observed about each input (samchon/ttsc#1384).
 *
 * TypeScript-Go probes `DirectoryExists(<root>/node_modules)` for every package
 * resolution, and every event below a recorded directory used to count against
 * it, so `vitest` writing its cache there filled the witness bound and sent
 * every later delivery to probe its whole input set. In the other direction,
 * replacing an ancestor directory reports only that directory, and an ancestor
 * that was not itself an input went unheard while silence stood as proof. Every
 * row is decided by one classifier the POSIX listener and the Windows broker
 * share.
 *
 * 1. Track a presence-only directory, a listed directory, a read file, and a
 *    missing candidate, outside a project and inside one, through a watch
 *    seam.
 * 2. Deliver each row's event and assert the witness it records, if any, that a
 *    rename-only tracker drops content changes, and that an event without a
 *    name is a mutation for every tracker.
 * 3. Verify two trackers of one project through one shared read and assert the
 *    root they both watch is read once, then replace a watched directory and
 *    assert the tracker withdraws its authority.
 */
export async function test_host_input_tracker_relevance_follows_observed_scopes(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-tracker-scopes-"),
  );
  TestProject.writeFiles(root, {
    "external/lib/types.d.ts": "export {};\n",
    "external/node_modules/pkg/index.d.ts": "export {};\n",
    "external/types/existing/index.d.ts": "export {};\n",
    "project/lib/types.d.ts": "export {};\n",
    "project/node_modules/pkg/index.d.ts": "export {};\n",
    "project/types/existing/index.d.ts": "export {};\n",
  });
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const identityReads: string[] = [];
  const open = async (
    base: string,
    events: "all" | "rename",
    preferredRoot?: string,
  ) => {
    const listeners = new Map<
      string,
      (eventType: string, filename: string | null) => void
    >();
    const scopes = new Map<string, TtscTrackedInputScope>([
      [at(base, "node_modules"), "presence"],
      [at(base, "types"), "children"],
      [at(base, "lib", "types.d.ts"), "content"],
    ]);
    const inputs = [...scopes.keys(), at(base, "missing", "candidate.ts")];
    const tracker = await createHostInputMutationTracker(
      inputs,
      {
        ...DEFAULT_FILESYSTEM_OPERATIONS,
        statBigInt: (location) => {
          identityReads.push(location);
          return DEFAULT_FILESYSTEM_OPERATIONS.statBigInt(location);
        },
        watch: (directory, listener) => {
          listeners.set(path.resolve(directory), listener);
          return { close: () => undefined };
        },
      },
      new Set(inputs),
      events,
      preferredRoot,
      scopes,
    );
    /** Deliver one event and report what it recorded. */
    const fire = (
      directory: string,
      eventType: string,
      filename: string | null,
    ): "change" | "mutation" | undefined => {
      tracker.changes.clear();
      tracker.membershipChanged = false;
      const listener = listeners.get(path.resolve(directory));
      assert.ok(listener, `no watch was opened on ${directory}`);
      listener(eventType, filename);
      if (tracker.changes.size === 0) return undefined;
      return tracker.membershipChanged ? "mutation" : "change";
    };
    return { fire, tracker };
  };

  const external = await open("external", "all");
  const rows: [string, string, string, "change" | "mutation" | undefined][] = [
    [at("external"), "change", "node_modules", undefined],
    [at("external"), "rename", "node_modules", "mutation"],
    [at("external"), "rename", "missing", "mutation"],
    [at("external"), "change", "unrelated", undefined],
    [at("external", "types"), "rename", "added", "mutation"],
    [at("external", "types"), "change", "existing", undefined],
    [at("external", "lib"), "change", "types.d.ts", "change"],
    [at("external", "lib"), "rename", "types.d.ts", "mutation"],
    [at("external", "lib"), "rename", "sibling.d.ts", undefined],
  ];
  for (const [directory, eventType, filename, expected] of rows) {
    assert.equal(
      external.fire(directory, eventType, filename),
      expected,
      `external ${eventType} ${filename}`,
    );
  }

  const internal = await open("project", "all", at("project"));
  for (const [filename, eventType, expected] of [
    ["node_modules/.vitest-cache/entry", "rename", undefined],
    ["node_modules/.vite-temp/config.mjs", "change", undefined],
    ["node_modules", "change", undefined],
    ["node_modules", "rename", "mutation"],
    ["lib", "rename", "mutation"],
    ["lib", "change", undefined],
    ["types/added", "rename", "mutation"],
    ["types/existing/deep.d.ts", "rename", undefined],
    ["missing/nested/candidate.ts", "change", "change"],
    ["other/file.ts", "rename", undefined],
  ] as const) {
    assert.equal(
      internal.fire(at("project"), eventType, filename),
      expected,
      `project ${eventType} ${filename}`,
    );
  }

  const renameOnly = await open("project", "rename", at("project"));
  assert.equal(
    renameOnly.fire(at("project"), "change", "lib/types.d.ts"),
    undefined,
    "a rename-only tracker drops content changes before classifying them",
  );
  assert.equal(renameOnly.fire(at("project"), "rename", "missing"), "mutation");
  // An event without a name is a backend's notice that events were lost below
  // the directory, as a Windows buffer overflow reports, so every tracker
  // counts it as a mutation of any kind (samchon/ttsc#1424).
  for (const tracker of [renameOnly, internal, external]) {
    assert.equal(
      tracker.fire(
        tracker === external ? at("external") : at("project"),
        "change",
        null,
      ),
      "mutation",
      "an unattributed change is a mutation",
    );
  }

  // A delivery verifies all of a generation's trackers with one shared read,
  // so the project root they both watch costs one metadata call.
  identityReads.length = 0;
  const seen = new Map<string, string | undefined>();
  internal.tracker.verifyLocations?.(seen);
  renameOnly.tracker.verifyLocations?.(seen);
  assert.deepEqual(identityReads, [at("project")]);
  assert.equal(internal.tracker.failed || renameOnly.tracker.failed, false);

  external.tracker.verifyLocations?.();
  assert.equal(external.tracker.failed, false, "unchanged locations hold");
  fs.renameSync(at("external", "lib"), at("external", "lib-old"));
  fs.mkdirSync(at("external", "lib"));
  external.tracker.verifyLocations?.();
  assert.equal(
    external.tracker.failed,
    true,
    "a replaced watched directory must withdraw the tracker's authority",
  );
}
