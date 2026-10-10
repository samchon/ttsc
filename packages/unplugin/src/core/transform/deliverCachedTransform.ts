import type { TtscCachedProjectTransform } from "./cache/TtscCachedProjectTransform";
import type { TtscTransformCache } from "./cache/TtscTransformCache";
import { evictGeneration } from "./cache/evictGeneration";
import { selectOrEvict } from "./cache/selectOrEvict";
import { reportMissingProgramOutput } from "./diagnostics/reportMissingProgramOutput";
import { reportSuccessDiagnostics } from "./diagnostics/reportSuccessDiagnostics";
import { TtscMissingProgramOutputError } from "./errors/TtscMissingProgramOutputError";
import { createTransformResult } from "./utils/createTransformResult";
import { TtscGenerationProof } from "./validation/TtscGenerationProof";
import { markCachedSourceServed } from "./validation/markCachedSourceServed";
import type { TtscTransformHooks } from "./watch/TtscTransformHooks";
import type { TtscWatchSelection } from "./watch/TtscWatchSelection";
import { notifyFailedGenerationInputs } from "./watch/notifyFailedGenerationInputs";
import { notifyVolatileDelivery } from "./watch/notifyVolatileDelivery";
import { notifyWatchInputs } from "./watch/notifyWatchInputs";

/**
 * Deliver both captured and reused generations through one failure boundary.
 *
 * WARNING (#1713): host capabilities and callbacks apply to every delivery,
 * including cache hits. Incomplete local results must never survive a failed
 * handoff or acquire a persistent record. Stable ordinary generations retain
 * their existing callback-failure recovery policy.
 *
 * A missing program output is an admitted absence: notify the same selection
 * inputs and return control to the host. Compile failure retains its existing
 * terminal policy through selectOrEvict and reports repair inputs.
 *
 * @evidence contracts/common.md#principled-implementation Captured and reused results share lifecycle admission, output selection, diagnostics and host handoff; incomplete ownership is evicted on any failed delivery effect, while missing output remains a host fallthrough.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous boundary removes duplicate initial/cache-hit delivery paths and their divergent callback and cleanup rules.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing outputs never manufacture transformed bytes or reusable observation authority; incomplete handoff failure cannot leave an owner for a sibling.
 * @evidence contracts/common.md#meaningful-documentation Native prose states per-delivery capability, callback failure, missing-output and compile-failure responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Native identities and host spellings remain delegated to the generation's existing output/watch owners.
 * @evidence contracts/performance.md#efficient-algorithms Selection uses generation indexes; diagnostics, output/map work and current host callbacks remain necessary per delivery. Watch input and record derivation retain their owning population costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Initial and reused answers share the exact same operation, while generation-owned indexes and the pass-qualified compiled result retain their separate validity premises.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Fresh-only admission releases capture resources; failed incomplete delivery evicts only its exact Promise. Ordinary selection/terminal and host lifecycle owners retain their established resource policy.
 */
export function deliverCachedTransform(props: {
  cache: TtscTransformCache | undefined;
  cached: TtscCachedProjectTransform;
  generation: Promise<TtscCachedProjectTransform>;
  key: string;
  epoch: number | undefined;
  file: string;
  source: string;
  hooks: TtscTransformHooks | undefined;
  selection: TtscWatchSelection;
}) {
  const {
    cache,
    cached,
    generation,
    key,
    epoch,
    file,
    source,
    hooks,
    selection,
  } = props;
  try {
    TtscGenerationProof.admitFreshOnly(
      cached,
      cache,
      key,
      generation,
      epoch,
      hooks,
    );
    reportSuccessDiagnostics(cached, epoch);
    let output;
    try {
      output = selectOrEvict(cache, key, generation, epoch, {
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
        tsconfig: cached.tsconfig,
      });
    } catch (error) {
      if (!(error instanceof TtscMissingProgramOutputError)) {
        notifyFailedGenerationInputs(hooks, cached, file, selection);
        throw error;
      }
      reportMissingProgramOutput(cached, error, epoch);
      notifyWatchInputs(hooks, cached, file, selection);
      markCachedSourceServed(cached, file);
      return undefined;
    }
    notifyWatchInputs(hooks, cached, file, selection);
    markCachedSourceServed(cached, file);
    notifyVolatileDelivery(hooks, cached, file);
    return createTransformResult(file, source, output);
  } catch (error) {
    if (cached.freshDeliveryOnly === true)
      evictGeneration(cache, key, generation);
    throw error;
  }
}
