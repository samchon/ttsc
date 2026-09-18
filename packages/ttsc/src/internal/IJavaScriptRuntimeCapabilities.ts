/**
 * What a JavaScript runtime executable can do, as measured by running it.
 *
 * Produced by {@link javascriptRuntimeCapabilities}, which asks the interpreter
 * itself rather than inferring from the host process: a `node` found on `PATH`,
 * a version-manager shim, and Bun can all stand in for the runtime a plugin
 * descriptor is evaluated with, and each supports a different loader.
 */
export type IJavaScriptRuntimeCapabilities = {
  /**
   * The executable is Bun. Bun loads TypeScript descriptors natively and has no
   * `module.registerHooks`, so the descriptor evaluator runs it without the ttsx
   * runtime-hook preload and isolates it from Bun's own config and `.env`
   * loading instead.
   */
  bun: boolean;

  /**
   * The absolute path the runtime reports as its own `process.execPath`, when
   * the probe could read one. A wrapper script and its real binary answer
   * differently here, which is how the evaluator reaches the physical
   * interpreter instead of a mutable shim.
   */
  executable?: string;

  /**
   * `module.registerHooks` exists (Node 22.15 and later), so the ttsx
   * synchronous runtime hooks can be installed in that process.
   */
  registerHooks: boolean;
};
