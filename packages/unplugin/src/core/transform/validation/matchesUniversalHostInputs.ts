import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { matchesUniversalHostInputEntries } from "./matchesUniversalHostInputEntries";
import { matchesUniversalHostInputProbes } from "./matchesUniversalHostInputProbes";
import { matchesUniversalHostInputTrees } from "./matchesUniversalHostInputTrees";
import { nativeInputPredicatesHold } from "./nativeInputPredicatesHold";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Validate universal descriptor/config inputs. Versioned native config
 * predicates are replayed before notification shortcuts; other proven inputs
 * retain reuse. Existing paths use the generation's native metadata manifest;
 * missing probes are grouped by the nearest existing directory and checked
 * through native candidate stats so alternate spellings cannot hide an existing
 * input.
 *
 * While the tracker proves every input the manifest covers unchanged, source
 * content is not read; plugin build environments still require their own
 * identity check. Otherwise each input is proven on its own: an entry or a
 * plugin source its tracker proves is skipped, and the rest are read. One input
 * a watch cannot prove, a plugin source outside the project on macOS, whose
 * stream no probe proves delivered (samchon/ttsc#1453), used to send every
 * universal input back to the disk on every delivery.
 *
 * @evidence contracts/common.md#principled-implementation Exact healthy notifications qualify covered source spellings, while tree environment checks remain mandatory because external build authority is independent of native source events.
 * @evidence contracts/common.md#clear-and-simple-design One coordinator combines existing-entry, missing-name and tree authority without duplicating their native observations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source watcher silence cannot replace toolchain/environment identity; failed or unproved scopes fall back to their owning validators.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs separate source-content reuse, mandatory environment checks and per-input fallback rather than claiming notifications eliminate every observation.
 * @evidence contracts/portability.md#os-neutral-implementation Filesystem-aware validators use actual tracker delivery capability and exact lexical coverage rather than platform-wide assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The coordinator borrows generation manifests and trackers without retaining a result or acquiring a handle.
 * @evidence contracts/performance.md#efficient-algorithms Every admission first replays all generation-owned typed config predicates; this mandatory cost includes native queries, file bytes or directory membership independently of watcher/epoch qualification.  The coverage scan stops at the first unproved input. Each coverage query checks overlapping unproven scopes and sampled events with native path comparisons; fallback adds unresolved bytes, native candidate probes and plugin tree enumeration. Mandatory environment qualification pays its owning dependency and environment-key costs on either route.
 * @evidence contracts/performance.md#reuse-equivalent-work Typed config predicates remain mandatory on every delivery. An exact-generation synchronous transaction may share their current replay across nested validators, but no pass or notification shortcut authorizes a later delivery to skip them.  Shared manifests and qualified silent sources avoid repeated content reads only while the owning tree validator also proves unchanged build environment.
 */
export function matchesUniversalHostInputs(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
  proof?: TtscGenerationProof.Transaction,
): boolean {
  if (!nativeInputPredicatesHold(cached, proof)) return false;
  let notificationsProveAll = true;
  for (const input of validation.covered) {
    if (!trackerProvesInputUnchanged(cached.hostInputMutationTracker, input)) {
      notificationsProveAll = false;
      break;
    }
  }
  if (notificationsProveAll)
    return matchesUniversalHostInputTrees(cached, validation, proof);
  return (
    matchesUniversalHostInputEntries(cached, validation) &&
    matchesUniversalHostInputProbes(cached, validation) &&
    matchesUniversalHostInputTrees(cached, validation, proof)
  );
}
