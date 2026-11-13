import { installRuntimeHooks } from "./runtime/installRuntimeHooks";

/**
 * Worker that builds dependency projects for a ttsx run while its entry project
 * builds (`RuntimeDependencyPrebuild`). Each argument is a project's config.
 * The worker runs under the program's environment and the run's manifest, so
 * each build lands in the run's dependency cache under the key the program asks
 * for; a project that fails to build is left for the program, which reports its
 * failure when it reaches it.
 */
for (const tsconfig of process.argv.slice(2)) {
  try {
    installRuntimeHooks.prebuild(tsconfig);
  } catch {
    // The program builds this project itself when it reaches it.
  }
}
