import fs from "node:fs";
import os from "node:os";
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
 * @throws When no marker is heard within five seconds.
 */
export async function settleFilesystemNotifications(): Promise<void> {
  if (process.platform !== "darwin") return;
  const directory = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-notification-barrier-")),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      let timer: NodeJS.Timeout | undefined;
      // The stream may start after the first write, so the marker is written
      // again until one is heard.
      const watcher = fs.watch(directory, { persistent: false }, () => {
        clearTimeout(timer);
        watcher.close();
        resolve();
      });
      const write = (): void => {
        attempts += 1;
        if (attempts > 500) {
          watcher.close();
          reject(new Error("no filesystem notification was heard"));
          return;
        }
        fs.writeFileSync(path.join(directory, "marker"), String(attempts));
        timer = setTimeout(write, 10);
      };
      write();
    });
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}
