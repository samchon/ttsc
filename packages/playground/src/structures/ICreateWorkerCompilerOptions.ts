import type { ILintPluginConfig } from "./ILintPluginConfig";
import type { ITypiaPluginConfig } from "./ITypiaPluginConfig";

/**
 * Options for {@link createWorkerCompiler}.
 *
 * @evidence contracts/common.md#principled-implementation Required runtime identity and optional virtual-project paths express boot and compilation inputs; false distinguishes disabled integrations from default integration settings.
 * @evidence contracts/common.md#clear-and-simple-design Boot inputs, virtual layout and plugin options remain one explicit factory record with nested plugin responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin names and defaults describe the supported playground integrations; sites override them through explicit configuration.
 * @evidence contracts/common.md#meaningful-documentation Member JSDoc explains defaults, registration identity and compiler-option ownership, with blank member lines following the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
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

  /** Tsconfig path relative to `workDir`. Defaults to `tsconfig.json`. */
  tsconfigPath?: string;

  /** Entry source path relative to `workDir`. Defaults to `src/playground.ts`. */
  entryFile?: string;

  /**
   * Typia integration. Pass `false` to disable. When omitted, defaults to `{
   * name: "typia", transformModule: "typia/lib/transform" }` — and only
   * actually runs when the per-call `options.typia` is not `false`.
   */
  typiaPlugin?: ITypiaPluginConfig | false;

  /** Lint integration. Pass `false` to disable. */
  lintPlugin?: ILintPluginConfig | false;

  /**
   * Extra entries spliced into the tsconfig's `compilerOptions`. Use to wire
   * site-specific plugins, paths, or lib overrides. The typia plugin entry is
   * appended automatically after any `plugins` array given here when
   * `typiaPlugin` is enabled — sites should NOT include it themselves, and an
   * entry naming the same transform module is replaced by the appended one.
   */
  extraCompilerOptions?: Record<string, unknown>;
}
