import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * The watch inputs for the configs that routed a delivery's file to the
 * selected project (samchon/ttsc#1397).
 *
 * The generation's own inputs cover the selected config and its `extends`
 * chain, but not the solution config whose `references` led there. Editing that
 * config, or the `include` of a project searched before the selected one, can
 * move the file to another project, and so can a referenced config appearing,
 * so reported config reads and failed discovery candidates are registered with
 * the host as well, with current host state as evidence or an unavailable
 * content marker when reading fails. They
 * join the delivery's other inputs in the one batch the host receives, so a
 * config both name is handed once.
 *
 * @param consulted Ordered reported config reads and failed discovery names.
 * @param filesystem The filesystem the evidence is read through.
 * @param spell The spelling every input is handed under for this delivery
 *   (`hostSpelling`).
 *
 * @evidence contracts/common.md#principled-implementation Reported routing spellings receive current host byte/kind observations, including failed discovery names whose appearance can change selection. Unavailable reads use the supported marker without certifying physical absence; recorded native identity stays distinct from notification spelling.
 * @evidence contracts/common.md#clear-and-simple-design A delivery-local identity context and one map produce the evidence batch; callers own deduplication and project-record accumulation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable configurations receive the supported missing state instead of fabricated contents or an assumption that the selected config is the only routing dependency.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain solution and searched-project dependencies, missing appearance and spelling parameters, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and supplied filesystem observations preserve actual identity; the caller's spelling callback changes registration spelling without altering the recorded facts.
 * @evidence contracts/performance.md#efficient-algorithms Every consulted occurrence is resolved, read/hashed or classified after read failure, queried for native identity and passed once to the caller spelling callback. Cost includes total bytes plus path/key text, cold ancestor/case/realpath observations and delegated callback work; duplicate occurrences still read current host state. The output retains one entry per occurrence, while the call-local identity context grows with queried paths/ancestors. This operation performs no project or subtree enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation observes current routing contents for one delivery; callers share the resulting batch across their callbacks rather than trusting earlier hashes without validity evidence.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The batch and identity context are local and no cache, descriptor or task survives independently of the caller.
 */
export function selectionInputs(
  consulted: readonly string[],
  filesystem: TtscTransformFilesystemOperations,
  spell: (input: string) => string,
): TtscWatchInput[] {
  if (consulted.length === 0) return [];
  const identities = createHostPathIdentityContext(filesystem);
  return consulted.map((config) => {
    const file = path.resolve(config);
    const hash = hostInputStateHash(file, filesystem);
    return {
      evidence: {
        identity: pathIdentityKey(file, identities),
        missing: hash === null,
        state: { codec: "host", hash: hash ?? MISSING_INPUT_STATE },
        ...(hash === null ? { unavailable: "missing" as const } : {}),
      },
      file: spell(file),
    };
  });
}
