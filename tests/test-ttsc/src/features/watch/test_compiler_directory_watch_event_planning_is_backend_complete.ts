import assert from "node:assert/strict";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { planCompilerDirectoryWatchEvent } from "../../../../../packages/ttsc/src/launcher/internal/watch/planCompilerDirectoryWatchEvent";

/**
 * Verifies compiler directory events map deterministically to watch actions.
 *
 * A named POSIX change is a candidate for the bytes to decide, since the file's
 * own watcher can miss it (samchon/ttsc#1583), named replacements rearm one
 * file, and filename-less events conservatively cover every surviving tracked
 * input on both POSIX and Windows. The supplied virtual path identity has no
 * aliases and unknown case policy; native case discovery is not exercised.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual directory-event planner for named content changes, replacements and unnamed notifications, checking exact change, rearm and refresh plans.
 * @evidence contracts/testing.md#independent-expectations Literal arrays and booleans specify event policy independently of the planner; supplied membership, existence and virtual identity describe the input authority only.
 * @evidence contracts/testing.md#distinguishing-cases POSIX content change differs from rename, Windows unnamed change does not rearm, a vanished member is excluded and an unrelated named event refreshes without inventing a candidate.
 * @evidence contracts/testing.md#execution-ownership Executes planner and identity policy in one source-unit process with supplied virtual filesystem operations; no native watch, filesystem case query, compiler or child process is needed.
 */
export const test_compiler_directory_watch_event_planning_is_backend_complete =
  (): void => {
    const root = path.resolve("watch-event-root");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    const identities = createProjectInputPathIdentityContext({
      platform: process.platform,
      realpath: (location) => location,
      caseSensitive: () => undefined,
    });
    const trackedFiles = new Map([
      [source, source],
      [config, config],
    ]);
    const exists = (location: string): boolean =>
      location === source || location === config;

    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        changed: source,
        event: "change",
        exists,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      { changes: [source], rearm: [], refresh: false },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        changed: source,
        event: "rename",
        exists,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      { changes: [source], rearm: [source], refresh: false },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        event: "rename",
        exists,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      {
        changes: [source, config],
        rearm: [source, config],
        refresh: true,
      },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        event: "change",
        exists,
        identities,
        location: root,
        platform: "win32",
        trackedFiles,
      }),
      {
        changes: [source, config],
        rearm: [],
        refresh: true,
      },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        event: "rename",
        exists: (location) => location === config,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      { changes: [config], rearm: [config], refresh: true },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        changed: path.join(root, "untracked.ts"),
        event: "change",
        exists,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      { changes: [], rearm: [], refresh: true },
    );
  };
