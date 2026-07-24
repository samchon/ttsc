import assert from "node:assert/strict";
import path from "node:path";

import { planCompilerDirectoryWatchEvent } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies compiler directory events map deterministically to watch actions.
 *
 * Ordinary POSIX changes stay with the file watcher, named replacements rearm
 * one file, and filename-less events conservatively cover every surviving
 * tracked input on both POSIX and Windows.
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
      { changes: [], rearm: [], refresh: false },
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
