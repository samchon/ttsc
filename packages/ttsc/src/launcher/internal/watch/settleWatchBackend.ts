import fs from "node:fs";

/**
 * Return once every watch this process has opened or closed so far delivers.
 *
 * On macOS, libuv serves every directory watch of a loop through one
 * FSEventStream. Opening or closing any watch re-creates that stream on libuv's
 * CoreFoundation thread, and the new stream reports only what happens after it
 * starts, so an event in between reaches no watcher and nothing says so
 * (samchon/ttsc#1583). Opening a watch returns before the re-creation, but
 * closing one waits for it (`uv__fsevents_close` blocks on the semaphore the
 * re-creation posts), and the thread takes the requests in order. A directory
 * watch opened and closed here therefore returns only after a stream covering
 * every watch opened before it has started. Where each watch is its own, this
 * is only an open and a close.
 *
 * A caller re-checks what it observes against its recorded state afterwards: a
 * change that landed in the gap is found by that check, and one after it is
 * delivered.
 *
 * @param directory An existing directory to open the settling watch on.
 */
export function settleWatchBackend(directory: string): void {
  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(directory, { persistent: false });
  } catch {
    // A directory that cannot be watched now settles nothing; the re-check
    // that follows still compares every input with its recorded state.
    return;
  }
  watcher.on("error", () => undefined);
  watcher.close();
}
