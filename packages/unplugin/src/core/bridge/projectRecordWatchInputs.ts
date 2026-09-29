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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Persisted evidence is paired with each absolute input; separate membership
 *   evidence represents the recorded policy and directory population at the root.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One adapter converts record representation into the observer's existing
 *   delivery-input representation without creating another observation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Membership uses the same codec as live deliveries rather than an invented
 *   file hash that could not represent the project's directory population.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain restored-session ownership and membership separation,
 *   with prose/tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The root membership input obtains physical identity from the host filesystem resolver and actual directory case policy, while persisted lexical input spellings remain paired with their original evidence.
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
