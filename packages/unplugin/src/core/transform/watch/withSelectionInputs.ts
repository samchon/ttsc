import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * Extend a delivery's watch inputs with the configs that routed its file to the
 * selected project (samchon/ttsc#1397).
 *
 * The generation's own inputs cover the selected config and its `extends`
 * chain, but not the solution config whose `references` led there. Editing that
 * config, or the `include` of a project searched before the selected one, can
 * move the file to another project, so each of those configs is registered with
 * the host as well, with its current content as evidence.
 */
export function withSelectionInputs(
  hooks: TtscTransformHooks | undefined,
  consulted: readonly string[],
  filesystem: TtscTransformFilesystemOperations,
): TtscTransformHooks | undefined {
  if (consulted.length === 0 || hooks === undefined) return hooks;
  if (hooks.addWatchFile === undefined && hooks.addWatchFiles === undefined) {
    return hooks;
  }
  const identities = createHostPathIdentityContext(filesystem);
  const extra = (): TtscWatchInput[] =>
    consulted.map((config) => {
      const file = path.resolve(config);
      const hash = hostInputStateHash(file, filesystem);
      return {
        evidence: {
          identity: pathIdentityKey(file, identities),
          missing: hash === null,
          state: { codec: "host", hash: hash ?? MISSING_INPUT_STATE },
          ...(hash === null ? { unavailable: "missing" as const } : {}),
        },
        file,
      };
    });
  const { addWatchFile, addWatchFiles } = hooks;
  // Batched, so the configs are appended once per delivery even for a host
  // that only takes one input at a time.
  return {
    ...hooks,
    addWatchFiles: (inputs: readonly TtscWatchInput[], failed?: boolean) => {
      const all = [...inputs, ...extra()];
      if (addWatchFiles !== undefined) {
        addWatchFiles(all, failed);
        return;
      }
      for (const input of all) addWatchFile!(input.file, input.evidence);
    },
  };
}
