import type { IBuildTsconfigOptions } from "../structures/IBuildTsconfigOptions";
import { DEFAULT_PLAYGROUND_COMPILER_OPTIONS } from "./DEFAULT_PLAYGROUND_COMPILER_OPTIONS";

/**
 * Serialize a tsconfig JSON document the wasm-side compiler can consume.
 *
 * `buildTsconfigJSON` is deliberately conservative — it returns a string the
 * caller writes to MemFS as-is, so there's no schema validation here. Bad
 * compiler options surface as wasm-side errors on the next build call.
 *
 * @evidence contracts/common.md#principled-implementation Object spread applies documented default-then-caller precedence and JSON.stringify emits the compiler's JSON input; compiler validation remains with the compiler.
 * @evidence contracts/common.md#clear-and-simple-design This operation only serializes configuration; the caller owns virtual writes and execution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Defaults are supported project settings and caller overrides remain explicit, without fixture-dependent branches.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains serialization ownership and validation timing in separate paragraphs under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
 */
export function buildTsconfigJSON(options: IBuildTsconfigOptions): string {
  return JSON.stringify({
    compilerOptions: {
      ...DEFAULT_PLAYGROUND_COMPILER_OPTIONS,
      module: options.module,
      outDir: options.outDir ?? "dist",
      rootDir: options.rootDir ?? "src",
      ...(options.compilerOptions ?? {}),
    },
    include: options.include ?? ["src"],
  });
}
