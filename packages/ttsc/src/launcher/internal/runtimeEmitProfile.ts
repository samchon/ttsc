import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { OwningModuleOptions } from "./runtime/OwningModuleOptions";
import { projectModuleOptions } from "./runtime/projectModuleOptions";

/**
 * What a ttsx runtime build emits, read from the options it compiles with: the
 * project's config and the flags forwarded before the entry, in the order the
 * compiler applies them.
 *
 * Two decisions follow from the emit, and reading the config alone answered
 * both for a build that is not the one that runs:
 *
 * - `moduleOptions` classify every file the build serves as CommonJS or an ES
 *   module. `ttsx --module esnext` on a CommonJS project emitted ESM that the
 *   runtime then served as CommonJS, and the entry never ran while the run
 *   exited 0.
 * - `forceRuntimeSourceMap` adds `--sourceMap` when the build would carry no map
 *   to inline. A forwarded `--inlineSourceMap` already carries one, and forcing
 *   `sourceMap` beside it failed the build with TS5053.
 *
 * @param project - The project the runtime build compiles.
 * @param passthrough - The flags forwarded to that build, in order.
 * @param binary - An explicit TypeScript-Go binary, for a response file.
 */
export function runtimeEmitProfile(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
): {
  /** The emit-deciding options the runtime classifies served files with. */
  moduleOptions: OwningModuleOptions;
  /** Whether the build must be asked for a source map. */
  forceRuntimeSourceMap: boolean;
} {
  const option = readEffectiveCompilerOptions(project, passthrough, binary);
  const compilerOptions = project.compilerOptions as Record<string, unknown>;
  // Invalid forwarded flags fail the build on their own; the config answers
  // until then.
  const read = (name: string, aliases?: readonly string[]): unknown =>
    option === null ? compilerOptions[name] : option(name, aliases);
  return {
    moduleOptions: projectModuleOptions({
      module: read("module", ["m"]),
      target: read("target", ["t"]),
    }),
    forceRuntimeSourceMap:
      !isOn(read("sourceMap")) && !isOn(read("inlineSourceMap")),
  };
}

/** Whether a config value or a forwarded flag value turns an option on. */
function isOn(value: unknown): boolean {
  return value === true || value === "true";
}
