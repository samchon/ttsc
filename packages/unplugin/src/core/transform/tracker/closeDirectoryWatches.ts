/** Detach and close every watcher, then preserve the first cleanup failure. */
export function closeDirectoryWatches(watchers: { close: () => void }[]): void {
  const owned = watchers.splice(0);
  let failed = false;
  let failure: unknown;
  for (const watcher of owned) {
    try {
      watcher.close();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}
