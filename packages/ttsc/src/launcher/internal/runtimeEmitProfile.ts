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
 * @param effectiveOptions - A reader already resolved for this exact build's
 *   project and forwarded arguments, or null after compiler rejection.
 *
 * @evidence contracts/common.md#principled-implementation Reading effective options in compiler order classifies the actual emit, and the two map booleans prevent asking for conflicting external and inline maps.
 * @evidence contracts/common.md#clear-and-simple-design The profile carries only module classification and whether a map must be requested; the local boolean reader normalizes supported true spellings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid forwarded arguments retain the compiler's own rejection path; config fallback is provisional classification rather than silently dropping those arguments.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and parameter comments explain emit-derived decisions and the two failure modes this boundary avoids; result members retain separate native comments.
 * @evidence contracts/portability.md#os-neutral-implementation Native response-file interpretation stays with effective-option resolution; this adapter passes binary identity and argument tokens without shell quoting or guessed filesystem case rules.
 */
export function runtimeEmitProfile(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
  effectiveOptions?: ReturnType<typeof readEffectiveCompilerOptions>,
): {
  /** The emit-deciding options the runtime classifies served files with. */
  moduleOptions: OwningModuleOptions;

  /** Whether the build must be asked for a source map. */
  forceRuntimeSourceMap: boolean;
} {
  const option =
    effectiveOptions === undefined
      ? readEffectiveCompilerOptions(project, passthrough, binary)
      : effectiveOptions;
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
