import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../../../../../utils/src/internal/waitFor";

/** Wait for the host to own runtime subscriptions before ending its lifecycle. */
export async function waitForViteWatchRegistration(server: any): Promise<void> {
  const files = new Set<string>();
  for (const environment of Object.values(server.environments) as any[]) {
    for (const file of environment.moduleGraph.fileToModulesMap.keys()) {
      if (
        !/(?:^|[/\\])node_modules(?:[/\\]|$)/.test(file) &&
        fs.existsSync(file)
      )
        files.add(path.resolve(file));
    }
  }
  // Vite adds outside-root runtime imports asynchronously. Closing during that
  // registration can strand its Chokidar subscription after server.close().
  // Observe the public watch inventory instead of delaying by an assumed time.
  const failures: unknown[] = [];
  const error = (cause: unknown) => failures.push(cause);
  const closed = () => failures.push(new Error("Vite server closed before runtime registration"));
  const check = () => {
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Vite runtime registration owner failures");
    if (server.httpServer?.listening === false)
      throw new Error("original Vite server is not listening for pending registration");
  };
  server.watcher.on("error", error);
  server.httpServer?.on("close", closed);
  try {
    await waitFor(() => {
      // This is a live subscription proof, not a historical delivery frame.
      check();
      const watched = new Set(
        Object.entries(server.watcher.getWatched()).flatMap(
          ([directory, names]) =>
            (names as string[]).map((name) => path.resolve(directory, name)),
        ),
      );
      return [...files].every((file) => watched.has(file));
    }, "Vite runtime watch registration", { check });
  } finally {
    server.watcher.off("error", error);
    server.httpServer?.off("close", closed);
  }
}
