/**
 * One plugin that declared the requested capability.
 *
 * `manifest` is the `--plugins-json` payload its sidecar needs to find its own
 * configured entry. Without it the sidecar loads an empty rule configuration
 * and answers as though the project declared nothing — an empty answer that
 * looks exactly like a project which genuinely publishes none.
 */
export interface ITtscCapabilityPlugin {
  /** Absolute path of the plugin's native sidecar executable. */
  binary: string;
  /** The `--plugins-json` payload to pass to the sidecar. */
  manifest: string;
  /**
   * The `--project-context-json` payload, or `undefined` when the plugin's
   * descriptor does not declare it wants one.
   *
   * A sidecar is handed a project root, not asked to derive one. Without this a
   * rule that resolves its own inputs — the documents an evidence claim reads,
   * a Prisma schema, an OpenAPI file — has no base to resolve them against, and
   * answers with an empty set rather than an error, because "this project
   * declares nothing" is a legitimate answer it cannot distinguish from "I was
   * not told where the project is".
   */
  projectContext?: string;
}
