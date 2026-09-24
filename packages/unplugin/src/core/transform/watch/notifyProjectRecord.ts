import fs from "node:fs";

import type { TtscProjectRecord } from "../../bridge/TtscProjectRecord";
import { membershipRecordDigest } from "../../bridge/membershipRecordDigest";
import { projectRecordFile } from "../../bridge/projectRecordFile";
import { warnUnwritableProjectRecord } from "../../bridge/warnUnwritableProjectRecord";
import { writeProjectRecordFile } from "../../bridge/writeProjectRecordFile";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { TtscProjectRecordUnwritableError } from "../errors/TtscProjectRecordUnwritableError";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import { projectMembershipInput } from "./projectMembershipInput";

/**
 * What each generation hands a build host in this process: the inputs read for
 * it, what is handed over with its record, and the records that hold them.
 */
const HANDED = new WeakMap<
  TtscCachedProjectTransform,
  {
    evidenced: readonly TtscWatchInput[];
    inputs: readonly TtscWatchInput[];
    /**
     * The records written, one per host root the generation reached, each with
     * the digest of the bytes written.
     */
    written: Map<string, string>;
  }
>();

/**
 * Write the project's record to a generation's state and hand it to the host
 * (`TtscTransformHooks.project`), once per delivery.
 *
 * The generation's inputs are read once per generation and process, and the
 * record below the root of each host the generation is delivered to is written
 * from them until a write lands; every later delivery to that host hands the
 * same record over without reading anything. The record's path is the host's
 * root's, while a generation is the cache's, and one cache can reach hosts
 * whose roots differ: a caller of `transformTtsc` can hand one cache to hosts
 * of its own, and the adapters' process-wide cache names the root of each
 * delivery by the directory the process runs in at the time. Each host takes
 * the record below its own root, the one place it accepts one. An input the
 * generation recorded no state for, a failed compile's recovery input or a walk
 * file no graph names, is read now, so a refresh at the next build start has a
 * state to prove it against; an input that cannot be read is recorded absent,
 * which its appearance moves.
 *
 * The record is written before it is handed over, so a host that snapshots the
 * file as the delivery registers it snapshots the generation's state, and a
 * host that compares content on its next start compares against that state. A
 * host that keeps no snapshot of the file, Rollup's cache, is handed the digest
 * of the bytes written for the generation to compare against instead
 * (`TtscProjectRegistration.digest`).
 *
 * A record lives below the host's tool directory, or, when that cannot be
 * written, below the fallback the host accepts (`fallbackToolDirectory`,
 * samchon/ttsc#1480): the first place a write lands is the one handed over,
 * since only a record the adapter can write can move. When no write lands this
 * time, a record that is there is handed over all the same: a module handed
 * over without it depends on its own bytes alone, and a host's persistent cache
 * restores it on those whatever its types did; the bytes it holds stand for the
 * last state written, and the next delivery of the generation writes it again.
 * A record that is not there is not handed over, since what a host does with a
 * dependency on a path that does not exist differs per host: the user is told
 * once that the host watches each module alone (`warnUnwritableProjectRecord`),
 * and the caller marks the module uncacheable, which keeps a one-shot build and
 * a persistent cache correct. A watching session would serve the module from
 * its watcher's silence after a type-only edit, so a successful delivery there
 * fails instead (`TtscProjectRecordUnwritableError`); a failed one keeps its
 * own diagnostics.
 *
 * @param inputs The generation's inputs, derived on first call.
 * @returns Whether the host was handed the record.
 * @throws {TtscProjectRecordUnwritableError} When a watching session's
 *   successful delivery can be handed no record.
 */
export function notifyProjectRecord(
  project: NonNullable<TtscTransformHooks["project"]>,
  cached: TtscCachedProjectTransform,
  failed: boolean,
  inputs: () => readonly TtscWatchInput[],
): boolean {
  let handed = HANDED.get(cached);
  if (handed === undefined) {
    const identities = createHostPathIdentityContext();
    const evidenced = inputs().map((input) =>
      readUnrecordedState(input, identities),
    );
    // One array per generation, so the bridge can tell a delivery of the same
    // generation from one of the next by the inputs it is handed.
    const membership = projectMembershipInput(cached);
    handed = {
      evidenced,
      inputs: membership === undefined ? evidenced : [...evidenced, membership],
      written: new Map(),
    };
    HANDED.set(cached, handed);
  }
  const records = [
    project.toolDirectory,
    ...(project.fallbackToolDirectory === undefined
      ? []
      : [project.fallbackToolDirectory]),
  ].map((directory) => projectRecordFile(directory, cached.tsconfig));
  let record: string | undefined;
  let refused: unknown;
  for (const candidate of records) {
    if (handed.written.has(candidate)) {
      record = candidate;
      break;
    }
    try {
      handed.written.set(
        candidate,
        writeProjectRecordFile(candidate, recordOf(cached, handed.evidenced)),
      );
      record = candidate;
      break;
    } catch (error) {
      refused ??= error;
    }
  }
  record ??= records.find((candidate) => fs.existsSync(candidate));
  if (record === undefined) {
    warnUnwritableProjectRecord(records[0]!, refused);
    if (project.watching === true && !failed) {
      throw new TtscProjectRecordUnwritableError(records[0]!, refused);
    }
    return false;
  }
  const registered = handed.inputs;
  const digest = handed.written.get(record);
  project.register({
    ...(digest === undefined ? {} : { digest }),
    failed,
    inputs: () => registered,
    record,
  });
  return true;
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
