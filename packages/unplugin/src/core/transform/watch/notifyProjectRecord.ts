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
    /** Retained generation facts, extended with new routing observations. */
    evidenced: readonly TtscWatchInput[];

    /** Watching snapshot, replaced only when another selection input is added. */
    inputs: readonly TtscWatchInput[];

    /** Incremented only when the retained evidenced input set expands. */
    revision: number;

    /** Lexical input spellings whose generation observations are already kept. */
    spellings: Set<string>;

    /**
     * The records written, one per host root the generation reached, each with
     * the digest of the bytes written.
     */
    written: Map<string, { digest: string; revision: number }>;
  }
>();

/**
 * Write the project's record to a generation's state and hand it to the host
 * (`TtscTransformHooks.project`), once per delivery.
 *
 * The generation's inputs are read once per generation and process, and the
 * record below the root of each host the generation is delivered to is written
 * from them until a write lands. Configs consulted while routing another
 * module are added to the same generation's input set. Only that expansion
 * replaces the watching snapshot and requires another write at each host.
 *
 * A fresh-only result with unavailable host observations has no complete
 * dependency closure to put in a record. It returns false without writing or
 * handing over an older record; its delivery marks the host cache volatile.
 *
 * The record's path is the host root's, while a generation is the cache's,
 * and one cache can reach hosts
 * whose roots differ: a caller of `transformTtsc` can hand one cache to hosts
 * of its own, and the adapters' process-wide cache names the root of each
 * delivery by the directory the process runs in at the time. Each host takes
 * the record below its own root, the one place it accepts one. An input the
 * generation recorded no state for, a failed compile's recovery input or a walk
 * file no graph names, is read now, so a refresh at the next build start has a
 * state to compare against. A failed byte read can record an observed directory
 * kind or unavailable-content marker; that marker does not certify physical
 * absence.
 *
 * Persistence writes changed bytes or accepts an identical existing record
 * before initial handoff. Later deliveries reuse that accepted revision without
 * rechecking the file here; hosts and bridge readers own current record proof,
 * including concurrent changes and unreadable/torn bytes. A
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
 * @param additionalInputs This delivery's config-selection inputs, which can
 *   differ between modules served from the same generation.
 * @returns Whether the host was handed the record.
 * @throws {TtscProjectRecordUnwritableError} When a watching session's
 *   successful delivery can be handed no record.
 *
 * @evidence contracts/common.md#principled-implementation Generation observations are retained by lexical input spelling and extended with new routing inputs; each host record is reusable only for the same evidenced snapshot, and bridge registrations receive a new array when that snapshot expands.
 * @evidence contracts/common.md#clear-and-simple-design One generation-owned handoff state separates evidenced inputs, watching snapshot and per-record written version; record serialization and unrecorded host-byte capture remain private helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A fresh-only result cannot manufacture persistent proof from current bytes or an older record; fallback remains an explicit host capability, and other unwritten or missing records preserve the supported volatility or watching error path.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain snapshot expansion, host roots, write-before-registration, fallback and watching failure; parameters and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Record paths come from host-owned directories and actual write/existence outcomes; observation identities use the shared native filesystem context without OS-wide permission or case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms First handoff scans/maps generation inputs and observes current host bytes/native identities for entries lacking state. Every delivery scans selection spellings, with key-text cost; expansion copies the growing union and derives membership. New/unaccepted host revisions also build records, scan membership, sort/encode nested dictionary keys, hash/compare persisted bytes and perform native path/parent/write work. Input/policy/text/query populations determine temporary storage and bytes, while registration callback work remains a delivery effect even for accepted revisions.
 * @evidence contracts/performance.md#reuse-equivalent-work Retained generation evidence and accepted per-host snapshot digests are shared while input-set revision agrees, under fixed generation/root/policy and caller nonmutation. Selection expansion invalidates prior host versions without suppressing registration effects. An accepted version skips persistence here, so this memo does not prove current on-disk bytes; record readers and host digest/snapshot comparison own that proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources WeakMap state retains unique lexical inputs/evidence, spelling keys and one digest/revision per reached host record path without a capacity or byte cap. Expansion replaces arrays, but registration closures and borrowers can retain earlier snapshots after replacement or generation release. Native record files also outlive the generation and this operation supplies no historical on-disk reclamation policy; no live watcher handle is owned here.
 */
export function notifyProjectRecord(
  project: NonNullable<TtscTransformHooks["project"]>,
  cached: TtscCachedProjectTransform,
  failed: boolean,
  inputs: () => readonly TtscWatchInput[],
  additionalInputs: readonly TtscWatchInput[] = [],
): boolean {
  // A fresh-only result has no complete dependency closure to persist. A
  // current read cannot manufacture the evaluation-time facts it lacks.
  if (cached.freshDeliveryOnly === true) return false;
  let handed = HANDED.get(cached);
  if (handed === undefined) {
    const identities = createHostPathIdentityContext();
    const evidenced = inputs().map((input) =>
      readUnrecordedState(input, identities),
    );
    // Stable snapshots let the bridge skip repeat registrations. A new routing
    // input below replaces the snapshot so its watcher index is refreshed.
    const membership = projectMembershipInput(cached);
    handed = {
      evidenced,
      inputs: membership === undefined ? evidenced : [...evidenced, membership],
      revision: 0,
      spellings: new Set(evidenced.map((input) => input.file)),
      written: new Map(),
    };
    HANDED.set(cached, handed);
  }
  const added: TtscWatchInput[] = [];
  for (const input of additionalInputs) {
    if (handed.spellings.has(input.file)) continue;
    handed.spellings.add(input.file);
    added.push(input);
  }
  if (added.length !== 0) {
    const identities = createHostPathIdentityContext();
    handed.evidenced = [
      ...handed.evidenced,
      ...added.map((input) => readUnrecordedState(input, identities)),
    ];
    const membership = projectMembershipInput(cached);
    handed.inputs =
      membership === undefined
        ? handed.evidenced
        : [...handed.evidenced, membership];
    ++handed.revision;
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
    if (handed.written.get(candidate)?.revision === handed.revision) {
      record = candidate;
      break;
    }
    try {
      handed.written.set(candidate, {
        digest: writeProjectRecordFile(
          candidate,
          recordOf(cached, handed.evidenced),
        ),
        revision: handed.revision,
      });
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
  const written = handed.written.get(record);
  const digest =
    written?.revision === handed.revision ? written.digest : undefined;
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
