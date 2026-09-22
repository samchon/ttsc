import { createHostPathIdentityContext } from "../transform/filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../transform/filesystem/pathIdentityKey";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * The inputs a project record holds, as the watch inputs a delivery of the
 * generation that wrote it would hand a watching session's bridge: every
 * recorded input with its evidence, and the root-file membership as the
 * membership input for the project root (`projectMembershipInput`).
 *
 * A record is the generation's state, and a bridge that takes these inputs
 * observes that state as if the generation had been delivered in this process:
 * it proves each against the disk as it takes them, and moves the record when
 * one changes from then on. That is what a session restored whole from a host's
 * persistent cache needs, since no delivery of the project runs in it
 * (`refreshProjectRecordFiles`).
 */
export function projectRecordWatchInputs(
  record: TtscProjectRecord,
): TtscWatchInput[] {
  const inputs: TtscWatchInput[] = Object.entries(record.inputs).map(
    ([file, evidence]) => ({ evidence, file }),
  );
  if (record.membership !== null) {
    inputs.push({
      evidence: {
        identity: pathIdentityKey(record.root, createHostPathIdentityContext()),
        missing: false,
        state: { codec: "membership", ...record.membership },
      },
      file: record.root,
    });
  }
  return inputs;
}
