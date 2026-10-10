import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscTransformCache } from "../cache/TtscTransformCache";
import { disposeCachedTransform } from "../cache/disposeCachedTransform";
import { evictGeneration } from "../cache/evictGeneration";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { preparePluginBuildEnvironments } from "../inputs/preparePluginBuildEnvironments";
import { toProjectKey } from "../project/toProjectKey";
import type { TtscTransformHooks } from "../watch/TtscTransformHooks";

/**
 * The shared ownership boundary for generation reuse in every adapter.
 *
 * WARNING (#1712, #1713): a module, a synchronous input-proof transaction, a
 * delivery pass, and a persistent generation have different lifetimes. Keep
 * those distinctions here. Do not add native preparation before every module,
 * keep positive toolchain checks for a whole process, or make Bun's adapter
 * invent its own cache policy. A proven pass shares its first deliveries;
 * persistent/repeated deliveries require new current observations. Incomplete
 * observations can share a coherent local result only inside an explicitly
 * nonwatching pass with actual host-cache withdrawal, never a record or pool.
 *
 * @evidence contracts/common.md#principled-implementation Explicit pass identity, source baseline and first-delivery membership delimit sharing; synchronous transactions independently qualify current native inputs and incomplete local outputs retain stricter lifecycle admission.
 * @evidence contracts/common.md#clear-and-simple-design One core owner supplies the same preparation, pass and fresh-only policies to every adapter instead of separate host-specific caches.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing observation never becomes complete snapshot authority; watching, persistent, repeated and unknown boundaries cannot borrow an incomplete pass result.
 * @evidence contracts/common.md#meaningful-documentation Native context names the four lifetimes and warns against the specific performance and stale-cache regressions they prevent.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Members delegate native observations to the generation's filesystem and the native environment owner.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members own baseline lookup, batch qualification and admission.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members establish the distinct sharing boundaries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no registry; transactions and generations have explicit callers.
 */
export namespace TtscGenerationProof {
  /**
   * One synchronous admission after all asynchronous preparation has settled.
   * Never retain this object in a generation or use it after an await.
   *
   * @evidence contracts/common.md#principled-implementation The exact cached owner prevents a proof of another result from supplying authority; optional native verdict is earned only by this synchronous transaction.
   * @evidence contracts/common.md#clear-and-simple-design One transaction carries environment observations and the shared native predicate verdict.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absent environment or predicate proof remains absent, never implied success.
   * @evidence contracts/common.md#meaningful-documentation Prose states the no-await lifetime and members distinguish owner, environment and predicate authority.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Native identity is retained by the referenced generation, not inferred by this carrier.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This carrier executes no computation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The creating operation and validators own sharing decisions.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous caller owns this handle-free carrier.
   */
  export interface Transaction {
    /** Exact generation being synchronously admitted. */
    readonly cached: TtscCachedProjectTransform;

    /** Current batch, absent when the pass already owns this input proof. */
    readonly environments?: ReadonlyMap<string, string | undefined>;

    /** Current native predicate verdict, unbuilt until its first gate. */
    nativePredicates?: boolean;
  }

  /**
   * Prepare native authority only when this delivery needs a new input proof.
   * The caller must create its synchronous transaction after awaiting this.
   *
   * @evidence contracts/common.md#principled-implementation A qualified first-delivery pass already owns environment proof; all other requests prepare actual authority before synchronous admission.
   * @evidence contracts/common.md#clear-and-simple-design One branch delegates native preparation rather than repeating it in adapters.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the existing explicit pass contract permits skipping preparation; no watcher silence or process lifetime substitutes for it.
   * @evidence contracts/common.md#meaningful-documentation Prose states preparation versus transaction ordering.
   * @evidence contracts/portability.md#os-neutral-implementation Preparation uses the actual generation filesystem and native toolchain reader.
   * @evidence contracts/performance.md#efficient-algorithms Qualified first deliveries perform baseline/identity lookups; other deliveries delegate one preparation per unique plugin directory.
   * @evidence contracts/performance.md#reuse-equivalent-work The pass shares its existing first-delivery proof; persistent and repeated deliveries establish new native authority.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Native requests belong to their environment owner; no transaction survives this await.
   */
  export async function prepare(
    cached: TtscCachedProjectTransform,
    file: string,
    epoch: number | undefined,
  ): Promise<void> {
    if (!sharesPass(cached, file, epoch))
      await preparePluginBuildEnvironments(
        cached.result,
        resultFilesystem(cached.result),
        cached,
      );
  }

  /**
   * Start fresh synchronous observation after notification and preparation
   * awaits, sharing actual SDK queries and native predicate replay locally.
   *
   * @evidence contracts/common.md#principled-implementation Current environments are batch-qualified after asynchronous work; a qualified pass needs no redundant native environment observation.
   * @evidence contracts/common.md#clear-and-simple-design One constructor binds observations to their exact generation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No current verdict is retained across deliveries or asynchronous boundaries.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the mandatory ordering and synchronous lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation Native observation remains with the environment witness owner and actual generation path identity.
   * @evidence contracts/performance.md#efficient-algorithms Plugin selection is generation-indexed; one batch shares variable hashing and distinct SDK metadata queries.
   * @evidence contracts/performance.md#reuse-equivalent-work Only the following synchronous validators borrow this batch; pass sharing uses its independent first-delivery contract.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller releases the transaction at the end of synchronous admission; no registry or native handle is acquired.
   */
  export function create(
    cached: TtscCachedProjectTransform,
    file: string,
    epoch: number | undefined,
  ): Transaction {
    return {
      cached,
      ...(sharesPass(cached, file, epoch)
        ? {}
        : {
            environments: PluginBuildEnvironmentReadings.cachedAll(
              selectPluginSourceInputs(cached.result).keys(),
            ),
          }),
    };
  }

  /**
   * Whether this module's first delivery belongs to this generation's proven
   * pass. A missing source baseline cannot acquire this permission.
   *
   * @evidence contracts/common.md#principled-implementation Epoch equality, coherent snapshot or admitted local-pass state, a recorded source and an unserved identity are all required.
   * @evidence contracts/common.md#clear-and-simple-design One predicate is shared by async preparation and synchronous source validation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An incomplete ordinary generation or absent module baseline cannot earn pass reuse.
   * @evidence contracts/common.md#meaningful-documentation Prose states the first-delivery and baseline restrictions.
   * @evidence contracts/portability.md#os-neutral-implementation Baselines use the generation's actual identity and compiler project-key policy.
   * @evidence contracts/performance.md#efficient-algorithms Baseline and served-set lookup avoid full input population traversal.
   * @evidence contracts/performance.md#reuse-equivalent-work Only first deliveries in the same explicitly declared pass share its proof; repeated and later-pass requests do not.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows generation state without retaining another owner.
   */
  export function sharesPass(
    cached: TtscCachedProjectTransform,
    file: string,
    epoch: number | undefined,
  ): boolean {
    if (
      epoch === undefined ||
      cached.deliveryEpoch !== epoch ||
      (cached.projectSnapshotComplete !== true &&
        cached.passDeliveryOnly !== true) ||
      (cached.freshDeliveryOnly === true && cached.passDeliveryOnly !== true)
    )
      return false;
    const identities = envelopeDerivation(cached).identityContext;
    const identity = pathIdentityKey(file, identities);
    if (cached.servedFiles?.has(identity)) return false;
    const key = toProjectKey(cached.projectRoot, file, identities);
    return (
      cached.sourceHashes?.[identity] !== undefined ||
      Object.hasOwn(cached.inputHashes, key) ||
      cached.externalInputHashes?.[identity] !== undefined
    );
  }

  /**
   * Admit and notify a fresh-only local delivery. A coherent pass-only success
   * can keep its result inside this pass after releasing capture resources;
   * every other fresh-only answer is detached before notifying the host.
   * Callback failure always evicts the incomplete owner.
   *
   * @evidence contracts/common.md#principled-implementation Explicit nonwatching, consistent project lifecycle and cache-withdrawal capability are required on every successful incomplete delivery; retention additionally needs the compile's exact pass-only epoch.
   * @evidence contracts/common.md#clear-and-simple-design One owner handles initial and cached fresh-only admission, resource release and host notification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Incomplete output never acquires a persistent record or publication, and failed/unknown/watching capability cannot leave a reusable owner.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish local pass retention, resource release and callback failure effects.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This lifecycle operation delegates native resource release to the generation disposer.
   * @evidence contracts/performance.md#efficient-algorithms Identity/epoch checks and one callback add no input scan; resource disposal visits the fixed tracker population.
   * @evidence contracts/performance.md#reuse-equivalent-work Only coherent locally admitted output in its exact nonwatching pass survives; a later pass or repeated module must obtain another result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Capture resources are released even when local output is kept; rejection and callback failure detach the owning Promise, and the cache lifecycle bounds retained result lifetime.
   */
  export function admitFreshOnly(
    cached: TtscCachedProjectTransform,
    cache: TtscTransformCache | undefined,
    key: string,
    generation: Promise<TtscCachedProjectTransform>,
    epoch: number | undefined,
    hooks: TtscTransformHooks | undefined,
  ): void {
    if (cached.freshDeliveryOnly !== true) return;
    const authorized =
      hooks?.watching === false &&
      hooks.markVolatile !== undefined &&
      (hooks.project?.watching === undefined ||
        hooks.project.watching === false);
    const retain =
      authorized &&
      epoch !== undefined &&
      cached.deliveryEpoch === epoch &&
      cached.passDeliveryOnly === true;
    disposeCachedTransform(cached);
    if (!retain) evictGeneration(cache, key, generation);
    if (cached.result.type === "success" && !authorized)
      throw new Error(
        "@ttsc/unplugin: plugin input observation is unavailable; fresh output requires an explicitly nonwatching host with supported cache withdrawal. Watching, unknown or contradictory lifecycles cannot safely observe its changes.",
      );
    try {
      hooks?.markVolatile?.();
    } catch (error) {
      evictGeneration(cache, key, generation);
      throw error;
    }
  }
}
