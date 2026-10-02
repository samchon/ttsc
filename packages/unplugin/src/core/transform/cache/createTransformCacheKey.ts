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
 * spellings of one tsconfig do. Compiler overlays, plugin payloads and alias
 * mappings retain their JSON declaration order: tied compiler path patterns
 * and arbitrary plugin payloads can observe it. Only the host-owned outer
 * manifest is serialized with sorted keys.
 *
 * @evidence contracts/common.md#principled-implementation Native tsconfig identity and actual JSON representations of compiler overlays, plugin payloads and alias mappings distinguish requested compiles, retaining declaration order that path-pattern ties or plugins can observe.
 * @evidence contracts/common.md#clear-and-simple-design Existing path identity and stable JSON encoding define the key; filesystem state remains the generation validator's responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Equivalent configuration spelling is normalized without dropping semantically relevant plugin order or pretending a matching key proves current inputs.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs name every key dimension and distinguish host-owned canonical manifest order from semantically observable external configuration order.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a string and retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms Four JSON serialisations and one path identity, linear in the option sizes, once per delivery.
 * @evidence contracts/performance.md#reuse-equivalent-work The key is the sharing identity: equal configurations map to one generation and differing ones never share.
 */
export function createTransformCacheKey(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): string {
  return stableStringify({
    aliasPaths: JSON.stringify(props.aliasPaths),
    compilerOptions: JSON.stringify(props.compilerOptions),
    plugins: JSON.stringify(props.plugins),
    tsconfig: pathIdentityKey(props.tsconfig),
  });
}
