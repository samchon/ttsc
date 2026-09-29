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
 * so each config the selection read is registered with the host as well, with
 * its current content as evidence, or as missing when it does not exist. They
 * join the delivery's other inputs in the one batch the host receives, so a
 * config both name is handed once.
 *
 * @param consulted The configs the selection read, in the order it read them.
 * @param filesystem The filesystem the evidence is read through.
 * @param spell The spelling every input is handed under for this delivery
 *   (`hostSpelling`).
 *
 * @evidence contracts/common.md#principled-implementation Every config consulted during routing becomes a host-byte observation, including missing configs whose appearance can change selection, with generation identity distinct from notification spelling.
 * @evidence contracts/common.md#clear-and-simple-design A delivery-local identity context and one map produce the evidence batch; callers own deduplication and project-record accumulation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable configurations receive the supported missing state instead of fabricated contents or an assumption that the selected config is the only routing dependency.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain solution and searched-project dependencies, missing appearance and spelling parameters, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and supplied filesystem observations preserve actual identity; the caller's spelling callback changes registration spelling without altering the recorded facts.
 * @evidence contracts/performance.md#efficient-algorithms The ordered batch maps O(S) consulted entries and hashes their B total bytes; one context shares identity metadata within the batch, with no project or subtree walk.
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
