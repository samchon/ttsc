import { readPaths } from "./readPaths";

/**
 * Build the `paths` overlay that forwards bundler aliases to the compiler.
 *
 * Because the generated tsconfig `extends` the project one and TypeScript
 * merges `compilerOptions` per option key, declaring `paths` here replaces the
 * project's own `paths` wholesale. The overlay therefore re-states the
 * project's effective mappings first, so tsconfig-only aliases keep resolving;
 * inline `compilerOptions.paths` from the plugin options ride on top, and the
 * bundler aliases win last; they mirror what the bundler will actually do at
 * resolve time.
 *
 * No `baseUrl` is emitted: TypeScript-Go removed the option (TS5102), and all
 * targets are absolute so none is needed.
 *
 * @evidence contracts/common.md#principled-implementation When bundler aliases require a paths overlay, effective inherited paths are restored before inline paths and final bundler mappings override them, matching replacement of the entire compiler option.
 * @evidence contracts/common.md#clear-and-simple-design One ordered object merge produces only the needed paths overlay; configuration ancestry and path validation remain with their existing readers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The overlay does not drop unrelated project mappings or resurrect unsupported baseUrl to compensate for misplaced generated configuration.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains option-level replacement and the precedence that preserves project-only aliases.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function createAliasCompilerOptions(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  effectivePaths: Record<string, string[]>,
): Record<string, unknown> {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    paths: {
      ...effectivePaths,
      ...readPaths(props.compilerOptions.paths),
      ...props.aliasPaths,
    },
  };
}
