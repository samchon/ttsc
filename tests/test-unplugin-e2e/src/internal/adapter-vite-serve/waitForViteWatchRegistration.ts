import fs from "node:fs";
import path from "node:path";

import { waitFor } from "./waitFor";

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
  await waitFor(() => {
    const watched = new Set(
      Object.entries(server.watcher.getWatched()).flatMap(
        ([directory, names]) =>
          (names as string[]).map((name) => path.resolve(directory, name)),
      ),
    );
    return [...files].every((file) => watched.has(file));
  }, "Vite runtime watch registration");
}
