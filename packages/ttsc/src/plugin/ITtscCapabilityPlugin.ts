/**
 * One plugin that declared the requested capability.
 *
 * `manifest` is the `--plugins-json` payload its sidecar needs to find its own
 * configured entry. Consumers must forward the selected manifest rather than
 * infer configuration from an empty capability answer; handling an absent
 * manifest remains with the particular sidecar implementation.
 *
 * @evidence contracts/common.md#principled-implementation A selected sidecar carries its executable plus full plugin manifest and optional requested project identity, so it can locate its own configuration without rediscovering the project.
 * @evidence contracts/common.md#clear-and-simple-design The result contains only invocation identity and payloads; discovery, building and sidecar lifetime remain with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability opt-in selects the sidecar, without package-name routing or a narrowed manifest that fabricates an empty configuration.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains why full manifest/context are necessary and absent projectContext meaning; paragraphs, member and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Binary is a resolved native executable path; manifest and project-context are JSON argv payloads, not shell command text or POSIX path fragments.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This invocation-data type performs no discovery, build or publication algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This representation states invocation identity but owns no reusable work cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Paths and payloads are plain data; a caller that starts the sidecar owns its process lifetime.
 */
export interface ITtscCapabilityPlugin {
  /** Absolute path of the plugin's native sidecar executable. */
  binary: string;

  /** The `--plugins-json` payload to pass to the sidecar. */
  manifest: string;

  /**
   * The `--project-context-json` payload, or `undefined` when the plugin's
   * descriptor does not declare it wants one.
   *
   * A context-capable sidecar receives the selected project identity to resolve
   * its own inputs, such as claim documents or a schema. When this payload is
   * absent, the sidecar owns its fallback or refusal policy; this result type
   * does not certify an empty answer or independently resolve that context.
   */
  projectContext?: string;
}

/**
 * A capability lookup and an opaque proof of its continued validity.
 *
 * A resolved empty list means no admitted sidecar matches the requested
 * capability. An unavailable lookup also has no entries, but must be retried rather than
 * retained as proof of absence. Even a resolved lookup can lack reusable proof,
 * for example when a descriptor does not declare its external reads or config
 * inheritance uses module resolution with unobserved selection authority.
 *
 * @evidence contracts/common.md#principled-implementation Status distinguishes completed lookup from degraded failure; the selected array contains only admitted nonempty-binary sidecars with the requested capability declared true. The owning freshness predicate separately decides reuse under its recorded premises, rather than an independently reconstructed consumer inventory.
 * @evidence contracts/common.md#clear-and-simple-design Plugins, outcome and one opaque validity query expose the consumer's decisions without leaking persistent-cache format or requiring a second package resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unavailable or unproved lookup is not reusable empty success; only the owner can validate discovery and evaluation authorities.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes empty resolved results, degraded failures and non-reusable resolved results; documented members and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Platform/path proof remains with the ttsc owner; consumers receive resolved native sidecar data and a query rather than reproducing separator or case policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This result type executes no lookup algorithm; its producing function owns computation cost.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work The owning predicate is the sole discovery freshness authority; consumer-specific publication inputs remain a separate reuse premise.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The consumer owns this snapshot and its closure lifetime; no global result registry or sidecar handle is retained by the representation.
 */
export interface ITtscCapabilityPluginResolution {
  /** Selected sidecars in configured order, empty for no match or unavailable. */
  readonly plugins: readonly ITtscCapabilityPlugin[];

  /** Whether lookup completed, distinct from an unavailable degraded answer. */
  readonly status: "resolved" | "unavailable";

  /**
   * Whether this exact lookup still has a complete current owning proof.
   *
   * False requires lookup again before reusing dependent output. Cache removal,
   * missing proof and observation failure are conservative false results.
   */
  readonly isCurrent: TtscCapabilityFreshnessQuery;
}

/**
 * Query whether one capability lookup retains its complete owning proof.
 *
 * False requires lookup again before dependent output is reused. A consumer
 * must also validate its own publication inputs; this query owns discovery and
 * descriptor validity alone.
 *
 * @evidence contracts/common.md#principled-implementation The query validates the original lookup's owning premises and refuses unknown state without deciding a consumer's separate publication inputs.
 * @evidence contracts/common.md#clear-and-simple-design A boolean query hides discovery and cache details while making required relookup explicit.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or failed proof cannot authorize reuse or be replaced with a guessed config-file inventory.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain false-result consequences and the consumer boundary before separated acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Owning native-path and process-authority checks define validity; the callback type embeds no OS-specific interpretation.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This callback type specifies a result and carries no implementation of observation traversal or hashing.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work True permits reuse only under the original complete discovery/evaluation identity; unavailable lookups always return false.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The query owns no sidecar. Its producer closure retains proof/context data while the result or a separately retained callback remains reachable; dropping the result alone does not release another reference to that callback.
 */
export type TtscCapabilityFreshnessQuery = () => boolean;
