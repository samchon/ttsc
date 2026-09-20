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
