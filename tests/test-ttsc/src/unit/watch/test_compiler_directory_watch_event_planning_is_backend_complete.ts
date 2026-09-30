import assert from "node:assert/strict";
import path from "node:path";

import { planCompilerDirectoryWatchEvent } from "../../../../../packages/ttsc/src/launcher/internal/watch/planCompilerDirectoryWatchEvent";

/**
 * Verifies compiler directory events map deterministically to watch actions.
 *
 * A named POSIX change is a candidate for the bytes to decide, since the file's
 * own watcher can miss it (samchon/ttsc#1583), named replacements rearm one
 * file, and filename-less events conservatively cover every surviving tracked
 * input on both POSIX and Windows.
 */
export const test_compiler_directory_watch_event_planning_is_backend_complete =
  (): void => {
    const root = path.resolve("watch-event-root");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
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
  };
