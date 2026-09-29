import fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { openLinuxDirectoryObserver } from "./linux/openLinuxDirectoryObserver";
import { subscribeLinuxDirectoryWatch } from "./linux/subscribeLinuxDirectoryWatch";

/**
 * Open one directory's change notification through the cache-owned watch seam,
 * falling back to the host's own `fs.watch`. Throws exactly where the
 * underlying watch does, so callers classify a registration failure
 * themselves.
 *
 * A foreign filesystem platform must supply its own watch capability; native
 * handles cannot prove observations made through another filesystem view.
 *
 * A recursive watch on a platform without native recursive notification never
 * reaches Node's emulation, which walks the whole tree synchronously and opens
 * one inotify watch per file. It opens the directory-level observer instead,
 * watching only the directories `admit` accepts (samchon/ttsc#1389); without
 * `admit`, every directory below the root is admitted, which only callers whose
 * tree is already bounded may rely on.
 *
 * On Linux every watch, recursive or not, lives in the Linux watch helper,
 * since `fs.watch` there can lose events without notice (samchon/ttsc#1426).
 * Its watches go live asynchronously, so the handle carries `ready`, which
 * resolves whether every watch it opened is live; nothing before that is
 * heard.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Injected watch authority takes precedence; native routing selects helper
 *   directory watches or supported host fs.watch without changing caller scope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One opening seam delegates recursive discovery to its owner and returns
 *   only closure and optional readiness, leaving verdicts with callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unsupported native recursion is not hidden behind Node's whole-tree
 *   emulation; supplied watchers are not replaced or patched.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs state backend routing, admitted scope and asynchronous
 *   readiness under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral callers use this seam; explicit native capability selection does
 *   not impose one operating system's path identity or recursion assumptions.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Opening delegates to the supplied backend; helper recursion visits admitted
 *   directories rather than opening per-file watches in excluded trees.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Non-recursive Linux watches share directory subscriptions through their
 *   owning helper; independent native fs.watch handles retain caller ownership.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The returned handle transfers watch ownership to the caller, which must
 *   close it on retirement. Recursive population is bounded by admitted scope.
 */
export function openDirectoryWatch(
  filesystem: TtscTransformFilesystemOperations,
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
  recursive = false,
  admit?: (directory: string) => boolean,
): { close: () => void; ready?: Promise<boolean> } {
  if (filesystem.watch !== undefined) {
    return filesystem.watch(directory, listener, onError, recursive);
  }
  if (
    filesystem.platform !== undefined &&
    filesystem.platform !== process.platform
  ) {
    throw new Error(
      "A foreign filesystem view requires its own watch capability",
    );
  }
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return recursive
      ? openLinuxDirectoryObserver(
          directory,
          admit ?? (() => true),
          listener,
          onError,
        )
      : subscribeLinuxDirectoryWatch(directory, listener, onError);
  }
  const watcher = fs.watch(
    directory,
    { persistent: false, recursive },
    (eventType, filename) =>
      listener(eventType, filename === null ? null : String(filename)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
