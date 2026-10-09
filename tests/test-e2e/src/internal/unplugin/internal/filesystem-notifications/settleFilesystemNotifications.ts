import fs from "node:fs";
import { TestProject } from "@ttsc/testing";
import path from "node:path";

/**
 * Wait until the operating system's notification pipeline has taken every
 * filesystem write made so far, so a watch opened afterwards hears only what
 * happens after it (samchon/ttsc#1418).
 *
 * On macOS, fseventsd assigns FSEvents ids to kernel events asynchronously, and
 * a stream created with "since now" starts at the id current at its creation. A
 * fixture written just before a watch opens can therefore reach the new stream
 * as fresh events. The adapter records them as it must, because a tracker
 * cannot tell a late event from a real change, and a scenario that counts
 * compiles right after writing its fixture then sees a spurious one. The daemon
 * takes the kernel's events in order, so once a marker written now is heard,
 * every earlier write already has an id and a later stream starts past it.
 *
 * Elsewhere this returns at once: inotify and Windows never report a write made
 * before the watch was added.
 *
 * @throws The original watch or marker-write error. Notification latency is not a failure.
 */
export async function settleFilesystemNotifications(): Promise<void> {
  if (process.platform !== "darwin") return;
  const directory = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-notification-barrier-"),
  );
  let watcher: fs.FSWatcher | undefined;
  let joined: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let settled = false;
  const failures: unknown[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const finish = (failed: boolean, cause?: unknown): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        if (failed) reject(cause);
        else resolve();
      };
      watcher = fs.watch(directory, () => finish(false));
      joined = new Promise<void>((resolveClose) => watcher!.once("close", resolveClose));
      watcher.on("error", (error) => {
        if (settled) failures.push(error);
        else finish(true, error);
      });
      // A stream may start after the first write. Repeated marker writes are
      // this registration protocol, not an elapsed failure policy.
      const write = (): void => {
        if (settled) return;
        try {
          fs.writeFileSync(path.join(directory, "marker"), String(++attempts));
          if (!settled) timer = setTimeout(write, 10);
        } catch (error) {
          finish(true, error);
        }
      };
      write();
    });
  } catch (error) {
    failures.push(error);
  } finally {
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    let safelyJoined = watcher === undefined;
    try {
      if (watcher !== undefined) {
        watcher.close();
        await joined;
        safelyJoined = true;
      }
    } catch (error) {
      failures.push(error);
    }
    try {
      if (safelyJoined) fs.rmSync(directory, { force: true, recursive: true });
      else TestProject.retainTemporaryDirectory(directory, "filesystem marker watcher closure is unproved");
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "filesystem notification marker and original closure");
}
