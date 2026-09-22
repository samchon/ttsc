import type { TtscProjectRecord } from "../../bridge/TtscProjectRecord";
import { membershipRecordDigest } from "../../bridge/membershipRecordDigest";
import { projectRecordFile } from "../../bridge/projectRecordFile";
import { writeProjectRecordFile } from "../../bridge/writeProjectRecordFile";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import { projectMembershipInput } from "./projectMembershipInput";

/** The generations whose record this process has written, with what it wrote. */
const WRITTEN = new WeakMap<
  TtscCachedProjectTransform,
  { inputs: readonly TtscWatchInput[]; record: string }
>();

/**
 * Write the project's record to a generation's state and hand it to the host
 * (`TtscTransformHooks.project`), once per delivery.
 *
 * The record is written from the generation's inputs once per generation and
 * process; every later delivery of the generation hands the same record over
 * without reading anything. An input the generation recorded no state for, a
 * failed compile's recovery input or a walk file no graph names, is read now,
 * so a refresh at the next build start has a state to prove it against; an
 * input that cannot be read is recorded absent, which its appearance moves.
 *
 * The record is written before it is handed over, so a host that snapshots the
 * file as the delivery registers it snapshots the generation's state, and a
 * host that compares content on its next start compares against that state. A
 * record that cannot be written is not handed over: the host then records no
 * project dependency for the module, and its next start runs the module again,
 * which is the safe side.
 *
 * @param inputs The generation's inputs, derived on first call.
 */
export function notifyProjectRecord(
  project: NonNullable<TtscTransformHooks["project"]>,
  cached: TtscCachedProjectTransform,
  failed: boolean,
  inputs: () => readonly TtscWatchInput[],
): void {
  let written = WRITTEN.get(cached);
  if (written === undefined) {
    const record = projectRecordFile(project.toolDirectory, cached.tsconfig);
    const identities = createHostPathIdentityContext();
    const evidenced = inputs().map((input) =>
      readUnrecordedState(input, identities),
    );
    try {
      writeProjectRecordFile(record, recordOf(cached, evidenced));
    } catch {
      return;
    }
    // One array per generation, so the bridge can tell a delivery of the same
    // generation from one of the next by the inputs it is handed.
    const membership = projectMembershipInput(cached);
    written = {
      inputs: membership === undefined ? evidenced : [...evidenced, membership],
      record,
    };
    WRITTEN.set(cached, written);
  }
  const { inputs: registered, record } = written;
  project.register({ failed, inputs: () => registered, record });
}

/** The record of a generation over its evidenced inputs. */
function recordOf(
  cached: TtscCachedProjectTransform,
  inputs: readonly TtscWatchInput[],
): TtscProjectRecord {
  const record: TtscProjectRecord = {
    inputs: {},
    membership:
      cached.projectDirectories === undefined
        ? null
        : {
            digest: membershipRecordDigest(
              cached.membershipPolicy,
              cached.projectDirectories,
            ),
            directories: cached.projectDirectories.map(
              (directory) => directory.path,
            ),
            policy: cached.membershipPolicy,
          },
    root: cached.projectRoot,
    signal: 0,
    tsconfig: cached.tsconfig,
  };
  for (const input of inputs) {
    if (input.evidence !== undefined)
      record.inputs[input.file] = input.evidence;
  }
  return record;
}

/**
 * An input as the record can hold it: with the state the generation recorded,
 * or, for one it recorded none for, the host bytes' state read now, one read
 * per input, since a failed compile's recovery inputs are every file of the
 * walk.
 */
function readUnrecordedState(
  input: TtscWatchInput,
  identities: ReturnType<typeof createHostPathIdentityContext>,
): TtscWatchInput {
  if (input.evidence?.state !== undefined) return input;
  const hash = hostInputStateHash(input.file) ?? MISSING_INPUT_STATE;
  const missing = hash === MISSING_INPUT_STATE;
  return {
    evidence: {
      identity:
        input.evidence?.identity ?? pathIdentityKey(input.file, identities),
      missing,
      state: { codec: "host", hash },
      ...(missing ? { unavailable: "missing" as const } : {}),
    },
    file: input.file,
  };
}
