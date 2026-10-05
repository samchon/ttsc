import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { stableStringify } from "../utils/stableStringify";

/**
 * Build the key one project generation is cached under.
 *
 * The declared compile configuration is represented by: the selected tsconfig's
 * filesystem identity, the compiler-options overlay, the plugin list, and the
 * translated aliases. Two adapter configurations that have different supported
 * JSON representations therefore receive different keys; native spellings
 * resolving to one config identity may share a key. A key does not encode
 * current filesystem content or prove freshness. Compiler overlays, plugin
 * payloads and alias mappings retain their JSON declaration order: tied
 * compiler path patterns and arbitrary plugin payloads can observe it. Only the
 * host-owned outer manifest is serialized with sorted keys.
 *
 * @evidence contracts/common.md#principled-implementation Native tsconfig identity and actual JSON representations of compiler overlays, plugin payloads and alias mappings distinguish requested compiles, retaining declaration order that path-pattern ties or plugins can observe.
 * @evidence contracts/common.md#clear-and-simple-design Existing path identity and stable JSON encoding define the key; filesystem state remains the generation validator's responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Equivalent configuration spelling is normalized without dropping semantically relevant plugin order or pretending a matching key proves current inputs.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs name every key dimension and distinguish host-owned canonical manifest order from semantically observable external configuration order.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a string and retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three payload serializations preserve supported JSON order; the outer
 *   four-field manifest sorts only its fixed keys and serializes their text
 *   again, with escaping/output space proportional to the payload text. The
 *   default path-identity transaction additionally observes uncached native
 *   aliases, ancestors and directory case policy; that work is not constant
 *   or bounded by option size alone. The caller builds this key per delivery.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Supported JSON configuration representation plus native config identity
 *   selects a shared generation within the cache. Declaration order remains
 *   observable; equal keys do not replace recorded-input validation. This
 *   function retains no serialized payload or native observation across calls.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The tsconfig component uses the actual host path-identity resolver's native
 *   alias and directory case observations instead of lowercasing by OS. It is
 *   a comparison address, not a replacement for the spelling passed to reads.
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
