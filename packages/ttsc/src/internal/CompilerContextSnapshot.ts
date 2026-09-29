import type { ITtscCompilerContext } from "../structures/ITtscCompilerContext";
import type { ITtscProjectPluginConfig } from "../structures/ITtscProjectPluginConfig";

/**
 * Own compiler options while preserving host selectors and JSON plugin input.
 *
 * Construction evaluates each entry's JSON serialization once. Date and custom
 * toJSON behavior is preserved in that captured payload; cycles and BigInt fail
 * at capture rather than during a later plugin launch. Every consumer receives
 * a fresh parsed payload, so it cannot mutate the retained snapshot.
 *
 * Worker transfer sends selectors and serialized payload separately because
 * structured cloning cannot carry the local JSON adapter method.
 *
 * @evidence contracts/common.md#principled-implementation Native plugin and descriptor inputs are JSON, whereas parent-side loading reads raw transform/enabled/configFile selectors; storing both preserves those distinct meanings even when custom toJSON changes the wire representation.
 * @evidence contracts/common.md#clear-and-simple-design One snapshot owner supplies local copying and worker transfer; the extra payload channel is required because structured cloning omits local behavior while the loader still needs the original selectors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The toJSON method belongs to a newly owned adapter, not a foreign object or global patch; unsupported cyclic/BigInt payloads fail instead of being replaced with invented defaults.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain capture timing, supported JSON conversion, failure timing, private ownership and the worker distinction, following documentation paragraph and tag separation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Context path strings and environment overrides remain native inputs; own undefined environment overrides are preserved rather than being lost through JSON serialization of the whole context.
 * @evidence contracts/performance.md#efficient-algorithms Capture and local copies take O(P) serialized plugin bytes plus O(E) environment entries; retaining JSON strings avoids a custom recursive object copier and consumers parse only the payload they receive.
 * @evidence contracts/performance.md#reuse-equivalent-work Captured JSON strings reuse the constructor's plugin serialization across operations; host selectors and the payload are immutable snapshots, while caller-visible parsed objects are freshly allocated.
 * @evidence contracts/performance.md#bound-retention-and-release-resources WeakMap associations disappear with their owned plugin adapters; retained strings scale with configured plugin bytes and are reclaimed with the compiler context rather than a global historical registry.
 */
export class CompilerContextSnapshot {
  /**
   * Capture options or copy a captured context without reevaluating conversion.
   *
   * @evidence contracts/common.md#principled-implementation Host selectors are read before first JSON conversion and retained independently; captured entries copy the retained payload rather than executing custom conversion again.
   * @evidence contracts/common.md#clear-and-simple-design Context spreading retains scalar options, environment copying preserves own undefined overrides, and one entry adapter owns the selector/payload distinction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only newly owned objects receive adapters; arbitrary plugin payload remains governed by actual JSON serialization, without foreign patches or invented fallback config.
   * @evidence contracts/common.md#meaningful-documentation The method states capture versus copying, while the enclosing native paragraphs explain JSON conversion timing and ownership consequences.
   * @evidence contracts/portability.md#os-neutral-implementation Native path fields remain unchanged and environment entries are copied without JSON omission; downstream native owners interpret their respective bases and name semantics.
   * @evidence contracts/performance.md#efficient-algorithms Context copying is linear in environment entries and plugin count; first capture serializes each plugin payload once, with subsequent clones sharing only immutable strings.
   * @evidence contracts/performance.md#reuse-equivalent-work Existing adapters use WeakMap-captured payload strings rather than reevaluating the user's conversion, because constructor snapshot inputs cannot change between operations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources New adapters own their strings through weak associations and remain reachable only through the returned context; no strong registry retains historical contexts.
   */
  public static clone(context: ITtscCompilerContext): ITtscCompilerContext {
    return {
      ...context,
      env: context.env ? { ...context.env } : undefined,
      plugins: Array.isArray(context.plugins)
        ? context.plugins.map((entry: ITtscProjectPluginConfig) => {
            const selectors = {
              enabled: entry.enabled,
              transform: entry.transform,
              ...(typeof entry.configFile === "string"
                ? { configFile: entry.configFile }
                : {}),
            };
            const payload = payloads.has(entry)
              ? payloads.get(entry)
              : JSON.stringify(entry);
            return ownedPlugin(selectors, payload);
          })
        : context.plugins,
    };
  }

  /**
   * JSON payload channel paired by index with worker context selectors.
   *
   * @evidence contracts/common.md#principled-implementation Index-preserving mapping keeps each captured JSON payload paired with the same entry whose host selectors the worker clones.
   * @evidence contracts/common.md#clear-and-simple-design Only payload strings cross this channel; compiler options remain in the ordinary context channel and local behavior is restored by one owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual captured JSON is transmitted, without fabricating clone-compatible substitutes for plugin values.
   * @evidence contracts/common.md#meaningful-documentation The native description explains pairing and worker transfer purpose; the enclosing comment documents why structured cloning needs a separate channel.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This maps captured JSON strings and performs no native path, environment or process interpretation.
   *
   * @evidence contracts/performance.md#efficient-algorithms Mapping costs O(N) references for N entries; already captured JSON strings need no serialization traversal.
   * @evidence contracts/performance.md#reuse-equivalent-work Retained payload strings preserve the constructor's conversion outcome across worker calls; uncaptured direct internal inputs are serialized once for this transfer.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string array transfers to the caller; this method acquires no independent retained population or native resource.
   */
  public static serializePlugins(
    context: ITtscCompilerContext,
  ): (string | undefined)[] | undefined {
    return Array.isArray(context.plugins)
      ? context.plugins.map((entry: ITtscProjectPluginConfig) =>
          payloads.has(entry) ? payloads.get(entry) : JSON.stringify(entry),
        )
      : undefined;
  }

  /**
   * Restore local adapters after the worker cloned selectors and payloads.
   *
   * @evidence contracts/common.md#principled-implementation Equal-length arrays establish one payload per selector entry; restored adapters expose the captured JSON result without reevaluating user conversion in the worker.
   * @evidence contracts/common.md#clear-and-simple-design Restoration owns only the transfer seam and delegates ordinary uncaptured contexts to clone; malformed pairing fails at that boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Pairing failures throw a protocol error rather than inventing defaults; adapter methods belong solely to newly owned objects.
   * @evidence contracts/common.md#meaningful-documentation Native wording identifies worker restoration and links it to the class's capture and transfer semantics, with prose and tags separated.
   * @evidence contracts/portability.md#os-neutral-implementation Native option spellings and own undefined environment entries survive restoration unchanged; the worker's separate environment adoption remains the native-name owner.
   * @evidence contracts/performance.md#efficient-algorithms One indexed pass builds N adapters and copying E environment entries costs O(N+E); plugin payload bytes are parsed only when a consumer requests JSON.
   * @evidence contracts/performance.md#reuse-equivalent-work Rehydration reuses the caller's captured conversion rather than recomputing custom behavior in another environment.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Restored contexts retain their configured payload bytes for their request lifetime; weak associations do not retain completed contexts globally.
   */
  public static restorePlugins(
    context: ITtscCompilerContext,
    serializedPlugins: readonly (string | undefined)[] | undefined,
  ): ITtscCompilerContext {
    if (serializedPlugins === undefined) return this.clone(context);
    if (
      !Array.isArray(context.plugins) ||
      context.plugins.length !== serializedPlugins.length
    )
      throw new Error(
        "ttsc: compiler plugin snapshot transfer is inconsistent",
      );
    return {
      ...context,
      env: context.env ? { ...context.env } : undefined,
      plugins: context.plugins.map(
        (entry: ITtscProjectPluginConfig, index: number) =>
          ownedPlugin(entry, serializedPlugins[index]),
      ),
    };
  }
}

const payloads = new WeakMap<ITtscProjectPluginConfig, string | undefined>();

/** Parent-side selectors stay separate from plugin-owned JSON representation. */
function ownedPlugin(
  entry: ITtscProjectPluginConfig,
  payload: string | undefined,
): ITtscProjectPluginConfig {
  const owned: ITtscProjectPluginConfig = {
    enabled: entry.enabled,
    transform: entry.transform,
    ...(typeof entry.configFile === "string"
      ? { configFile: entry.configFile }
      : {}),
  };
  Object.defineProperty(owned, "toJSON", {
    value: () => (payload === undefined ? undefined : JSON.parse(payload)),
  });
  payloads.set(owned, payload);
  return owned;
}
