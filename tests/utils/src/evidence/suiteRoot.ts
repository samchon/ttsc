import path from "node:path";

/**
 * Absolute path of the feature suite's own package root.
 *
 * Both the workspace lookup and the plugin cache location are anchored here
 * rather than on the process working directory, so a case behaves the same
 * whether the suite is driven from the repository root or from its own
 * package.
 */
export const suiteRoot: string = path.resolve(import.meta.dirname, "..", "..", "..", "test-e2e");
