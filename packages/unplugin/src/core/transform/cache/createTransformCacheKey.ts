import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { stableStringify } from "../utils/stableStringify";

/**
 * Build the key one project generation is cached under.
 *
 * Every input that changes what the compile would produce is part of the key:
 * the selected tsconfig's filesystem identity, the compiler-options overlay,
 * the plugin list, and the translated aliases. Two adapter configurations that
 * would compile differently therefore never share a generation, while two
 * spellings of one tsconfig do. The value is serialized with sorted keys, so
 * option objects built in a different order still map to one key.
 */
export function createTransformCacheKey(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): string {
  return stableStringify({
    aliasPaths: props.aliasPaths,
    compilerOptions: props.compilerOptions,
    plugins: props.plugins,
    tsconfig: pathIdentityKey(props.tsconfig),
  });
}
