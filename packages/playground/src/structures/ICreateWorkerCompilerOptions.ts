import type { ILintPluginConfig } from "./ILintPluginConfig";
import type { ITypiaPluginConfig } from "./ITypiaPluginConfig";

/** Options for {@link createWorkerCompiler}. */
export interface ICreateWorkerCompilerOptions {
  /** URL of the site's pre-built playground.wasm. */
  wasmUrl: string;
  /** URL of the matching wasm_exec.js. Defaults to next to wasmUrl. */
  wasmExecUrl?: string;
  /**
   * `globalThis[apiName]` the wasm binds. Must match the `apiName` passed to
   * `host.Expose` when the site's wasm was built.
   */
  apiName: string;

  /** In-MemFS project root. Defaults to `/work`. */
  workDir?: string;
  /** tsconfig path relative to `workDir`. Defaults to `tsconfig.json`. */
  tsconfigPath?: string;
  /** Entry source path relative to `workDir`. Defaults to `src/playground.ts`. */
  entryFile?: string;

  /**
   * Typia integration. Pass `false` to disable. When omitted, defaults to
   * `{ name: "typia", transformModule: "typia/lib/transform" }` — and only
   * actually runs when the per-call `options.typia` is not `false`.
   */
  typiaPlugin?: ITypiaPluginConfig | false;

  /** Lint integration. Pass `false` to disable. */
  lintPlugin?: ILintPluginConfig | false;

  /**
   * Extra entries spliced into the tsconfig's `compilerOptions`. Use to wire
   * site-specific plugins, paths, or lib overrides. The typia plugin entry
   * is appended automatically when `typiaPlugin` is enabled — sites should
   * NOT include it here.
   */
  extraCompilerOptions?: Record<string, unknown>;
}
