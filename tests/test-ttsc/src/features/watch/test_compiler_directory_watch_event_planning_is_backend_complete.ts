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
 * 1. Plan a named POSIX change and rename for a tracked file and require its
 *    change, its rearm and no refresh.
 * 2. Plan filename-less events on POSIX and Windows and require every surviving
 *    tracked input to change, with a refresh.
 * 3. Plan a filename-less rename after an input disappeared (only the survivor
 *    changes) and a named change of an untracked file (no change, refresh
 *    only).
 * 4. Contrast Windows named rename, missing/empty members and an outside root.
 * 5. For named untracked paths, refresh only for compiler-readable names,
 *    member-holding paths, member-proven mapper extensions and directories a
 *    backend may not descend into (#1865).
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual directory-event planner for named content changes, replacements and unnamed notifications, checking exact change, rearm and refresh plans.
 * @evidence contracts/testing.md#independent-expectations Literal arrays and booleans specify event policy independently of the planner; supplied membership, existence and virtual identity describe the input authority only.
 * @evidence contracts/testing.md#distinguishing-cases Named untracked logs (present or removed), package.json, a declaration, a removed member-holding directory, a recursive-backend directory change versus rename, a per-directory backend, an unclassified existing path and an unadmitted versus member-proven mapper extension separate a listing from none. POSIX named content change differs from rename; Windows named rename and unnamed change never rearm. Named missing, empty membership and unrelated named events refresh without a candidate; unnamed events exclude a surviving member outside the subscribed root. Physical/case-alias policy is separately owned by identity units, not simulated as native watch delivery here.
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
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        changed: source,
        event: "rename",
        exists,
        identities,
        location: root,
        platform: "win32",
        trackedFiles,
      }),
      { changes: [source], rearm: [], refresh: false },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        changed: source,
        event: "change",
        exists: () => false,
        identities,
        location: root,
        platform: "linux",
        trackedFiles,
      }),
      { changes: [], rearm: [], refresh: true },
    );
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        event: "rename",
        exists,
        identities,
        location: root,
        platform: "linux",
        trackedFiles: new Map(),
      }),
      { changes: [], rearm: [], refresh: true },
    );
    // A named untracked path pays for a listing only when it can move
    // membership (#1865).
    const log = path.join(root, "build.log");
    const directory = path.join(root, "src");
    const empty = path.join(root, "assets");
    const mapped = path.join(root, "src", "query.sql");
    const plan = (props: {
      changed: string;
      event?: string;
      exists?: (location: string) => boolean;
      isDirectory?: (location: string) => boolean;
      platform?: NodeJS.Platform;
      trackedFiles?: ReadonlyMap<string, string>;
    }) =>
      planCompilerDirectoryWatchEvent({
        changed: props.changed,
        event: props.event ?? "change",
        exists: props.exists ?? (() => true),
        isDirectory: "isDirectory" in props ? props.isDirectory : () => false,
        identities,
        location: root,
        platform: props.platform ?? "win32",
        trackedFiles: props.trackedFiles ?? trackedFiles,
      }).refresh;
    assert.equal(
      plan({ changed: log }),
      false,
      "a log is never compiler input",
    );
    assert.equal(
      plan({ changed: log, exists: () => false }),
      false,
      "a removed log cannot drop a member",
    );
    assert.equal(
      plan({ changed: path.join(root, "pkg", "package.json") }),
      true,
      "package.json moves resolution",
    );
    assert.equal(
      plan({ changed: path.join(root, "types.d.ts") }),
      true,
      "a declaration can become a member",
    );
    assert.equal(
      plan({ changed: directory, exists: () => false }),
      true,
      "a removed directory holding members drops them",
    );
    const isEmpty = (location: string) => location === empty;
    assert.equal(
      plan({ changed: empty, isDirectory: isEmpty }),
      false,
      "a recursive backend reports a directory's entries itself",
    );
    assert.equal(
      plan({ changed: empty, isDirectory: isEmpty, event: "rename" }),
      true,
      "a directory moved in can bring readable files",
    );
    assert.equal(
      plan({ changed: empty, isDirectory: isEmpty, platform: "linux" }),
      true,
      "a per-directory backend cannot see inside a new directory",
    );
    assert.equal(
      plan({ changed: empty, isDirectory: undefined }),
      true,
      "an existing path is a directory when the caller cannot say",
    );
    assert.equal(
      plan({ changed: mapped }),
      false,
      "an extension nothing admits stays out",
    );
    assert.equal(
      plan({
        changed: mapped,
        trackedFiles: new Map([
          ...trackedFiles,
          [path.join(root, "src", "a.sql"), path.join(root, "src", "a.sql")],
        ]),
      }),
      true,
      "an extension a content mapper admitted, shown by a member, can join",
    );

    const outside = path.join(path.dirname(root), "outside.ts");
    assert.deepEqual(
      planCompilerDirectoryWatchEvent({
        event: "rename",
        exists: () => true,
        identities,
        location: root,
        platform: "linux",
        trackedFiles: new Map([
          [source, source],
          [outside, outside],
        ]),
      }),
      { changes: [source], rearm: [source], refresh: true },
    );
  };
