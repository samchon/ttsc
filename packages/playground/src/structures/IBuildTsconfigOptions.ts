/** Options accepted by {@link buildTsconfigJSON}. */
export interface IBuildTsconfigOptions {
  /**
   * Module emit shape. Sites preview-render ESM, then re-run as CommonJS for
   * the in-page `new Function` sandbox.
   */
  module: "ESNext" | "CommonJS";
  /** Output directory relative to project root. Defaults to `"dist"`. */
  outDir?: string;
  /** Source root relative to project root. Defaults to `"src"`. */
  rootDir?: string;
  /**
   * Extra entries spliced into `compilerOptions`. Use for plugins, paths, lib
   * overrides, etc.
   */
  compilerOptions?: Record<string, unknown>;
  /** Project `include` globs. Defaults to `["src"]`. */
  include?: readonly string[];
}
