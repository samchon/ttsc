/**
 * One plugin as the capability-resolution cache records it.
 *
 * The cache answers "which plugins declare capability X" without evaluating
 * every descriptor again; each recorded plugin keeps what that answer needs.
 */
export interface ITtscCapabilityResolutionPlugin {
  /** Absolute path of the plugin's native sidecar executable. */
  binary: string;
  /** The capabilities the plugin's descriptor declared, by name. */
  capabilities: Record<string, boolean>;
  /** The plugin's source directory, fingerprinted to validate the entry. */
  source: string;
}
