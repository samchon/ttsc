import fs from "node:fs";

import { openLinuxDirectoryObserver } from "../transform/tracker/linux/openLinuxDirectoryObserver";

/**
 * Open the in-process recursive observer for one input observer scope, on a
 * platform whose scopes are not brokered: Windows and macOS open theirs in the
 * isolated watch broker instead (`openIsolatedRecursiveWatch`).
 *
 * Non-persistent, so it never keeps a host process alive by itself. Errors are
 * reported to `onError`, which moves the scope's entries to the bounded
 * fallback poll instead of losing them.
 *
 * The non-Windows/non-macOS branch selects the Linux directory observer instead
 * of Node recursive traversal. It watches admitted directories and those its
 * handle's `track` names (samchon/ttsc#1389); enumeration still sees entries it
 * does not admit. Its watches live in the Linux helper and go live
 * asynchronously (samchon/ttsc#1426), so once they are, the scope re-checks
 * entries through one unattributed callback: an entry could have changed before
 * any watch heard it. That callback requests a recheck, not proof of a complete
 * event history. Unsupported helper platforms or acquisition errors must fall
 * back through the owning observer's failure handling.
 *
 * @evidence contracts/common.md#principled-implementation Linux directory-level observation watches admitted paths and triggers readiness rechecks; native recursive failures enter the same conservative fallback boundary.
 * @evidence contracts/common.md#clear-and-simple-design An explicit platform branch selects the Linux helper or Node backend, returning closure and optional directory tracking; actual readiness/failure stays with the selected backend.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readiness triggers actual recorded-state checks, without assuming handle construction proves earlier unchanged inputs.
 * @evidence contracts/common.md#meaningful-documentation The prose explains recursive emulation cost and why asynchronous startup requires an unattributed event.
 * @evidence contracts/portability.md#os-neutral-implementation The non-Windows/non-macOS branch delegates to the Linux helper, whose availability must actually hold; the other branch passes native root/recursive/nonpersistent options to Node. Platform selection alone proves no case policy, watcher coverage or success. Errors withdraw authority through the owner rather than pretending unsupported helper platforms work.
 * @evidence contracts/performance.md#efficient-algorithms The helper enumerates admitted directory topology: D directory acquisitions still inspect E listed entries/native metadata and admission callbacks. The Node branch delegates recursive acquisition/notification work to its backend; neither one wrapper call nor directory-only handles bound listing bytes or callback revalidation cost.
 * @evidence contracts/performance.md#reuse-equivalent-work The shared Linux watch helper owns backend subscriptions, while scope callbacks keep their own coverage and proof conditions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned native/helper handle owns a scope until close; nonpersistence does not itself release it. Helper directory count follows admitted/explicitly tracked topology. The observer closes failed, unused external and disposed scopes; setup/cleanup can throw, and this wrapper adds no rollback, timeout or listener-effect cancellation beyond its backend.
 */
export function openRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
  admit: (directory: string) => boolean = () => true,
): {
  close(): void;
  track?(file: string, subtree?: boolean): void;
  prune?(): void;
} {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    const observer = openLinuxDirectoryObserver(root, admit, listener, onError);
    void observer.ready.then((live) => {
      if (live) listener("rename", null);
    });
    return observer;
  }
  const watcher = fs.watch(
    root,
    { persistent: false, recursive: true },
    (eventType, file) =>
      listener(eventType, file === null ? null : String(file)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
