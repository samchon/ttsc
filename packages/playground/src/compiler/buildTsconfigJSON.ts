import type { IBuildTsconfigOptions } from "../structures/IBuildTsconfigOptions";
import { DEFAULT_PLAYGROUND_COMPILER_OPTIONS } from "./DEFAULT_PLAYGROUND_COMPILER_OPTIONS";

/**
 * Serialize a tsconfig JSON document the wasm-side compiler can consume.
 *
 * `buildTsconfigJSON` is deliberately conservative — it returns a string the
 * caller writes to MemFS as-is, so there's no schema validation here. Bad
 * compiler options surface as wasm-side errors on the next build call.
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
