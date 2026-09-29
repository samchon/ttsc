import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { toProjectKey } from "../project/toProjectKey";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";

/**
 * Record declared-input content/metadata changes, relevant directory membership
 * changes and compile-time event witnesses from the before/after walks.
 * Unidentifiable file failures stay conservative; the shared recorder bounds
 * retained witnesses and reports dropped occurrences.
 *
 * @evidence contracts/common.md#principled-implementation Witness selection mirrors stable-walk comparisons: declared file keys, relevant directory maps and compile-time membership events attribute the actual absent or changed proof rather than just recording a false verdict.
 * @evidence contracts/common.md#clear-and-simple-design Local helpers distinguish walk failures, directory selection and tracker attribution, while one shared recorder owns bounds and witness identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed identity conversion retains the walk failure, omitted tracker evidence remains counted and an otherwise empty failed capture gets an explicit incomplete-snapshot witness.
 * @evidence contracts/common.md#meaningful-documentation Native prose states compared evidence and conservative/bounded reporting, with documented props separated and private helper comments explaining their selection responsibility.
 * @evidence contracts/portability.md#os-neutral-implementation Declared keys map through the supplied filesystem identity context; diagnostic source paths use Node native resolution rather than a universal lowercase or separator replacement rule.
 * @evidence contracts/performance.md#efficient-algorithms Hash keys and relevant directory maps are compared in linear passes using Set/Map lookup, and bounded witness storage avoids retaining the full comparison result.
 * @evidence contracts/performance.md#reuse-equivalent-work Two walk passes and the directory comparisons use shared recorder deduplication; declaration selection and the supplied identities reuse captured observations instead of re-reading files.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the bounded target collection; local directory maps and union sets die after reporting and no tracker lifecycle is acquired by the recorder.
 */
export function recordProjectSnapshotFailures(
  failures: TtscGenerationProofFailures,
  props: {
    /** Complete pre-compile walk observation, including any failed reads. */
    before: ReturnType<typeof collectProjectInputSnapshot>;

    /** Declared project keys; undefined selects every observed file key. */
    declared: ReadonlySet<string> | undefined;

    /** Shared native identity context used to classify failed path relevance. */
    identities: FilesystemPathIdentityContext;

    /** Native root used to display project-relative identity keys. */
    projectRoot: string;

    /** Post-compile walk used for content, metadata and membership comparison. */
    snapshot: ReturnType<typeof collectProjectInputSnapshot>;

    /** Observer that spans the compile window; absence contributes no event list. */
    tracker?: TtscProjectMutationTracker;
  },
): void {
  /** Attribute failed reads, excluding only resolvable undeclared file keys. */
  const recordWalk = (
    snapshot: ReturnType<typeof collectProjectInputSnapshot>,
  ): void => {
    for (const failure of snapshot.walkFailures) {
      if (failure.kind.startsWith("file-") && props.declared !== undefined) {
        try {
          const key = toProjectKey(
            props.projectRoot,
            failure.path,
            props.identities,
          );
          if (!props.declared.has(key)) continue;
        } catch {
          // An unidentifiable failed input taints the complete project walk.
        }
      }
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: failure.kind,
        path: failure.path,
      });
    }
  };
  recordWalk(props.before);
  recordWalk(props.snapshot);

  const keys =
    props.declared ??
    new Set([
      ...Object.keys(props.before.hashes),
      ...Object.keys(props.snapshot.hashes),
    ]);
  for (const key of keys) {
    if (props.before.hashes[key] !== props.snapshot.hashes[key]) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "input-content-changed",
        path: path.resolve(props.projectRoot, key),
      });
    }
    if (
      props.before.fileSignatures[key] !== props.snapshot.fileSignatures[key]
    ) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "input-metadata-changed",
        path: path.resolve(props.projectRoot, key),
      });
    }
  }

  // The same selection `sameProjectDirectories` decides by: a directory that
  // can hold no program input on either side is no witness, however it churns.
  /** Index only directories whose membership can affect program inputs. */
  const relevantDirectories = (
    snapshot: ReturnType<typeof collectProjectInputSnapshot>,
  ): Map<string, string> =>
    new Map(
      snapshot.projectDirectories
        .filter((entry) => entry.relevant)
        .map((entry) => [entry.path, entry.signature]),
    );
  const leftDirectories = relevantDirectories(props.before);
  const rightDirectories = relevantDirectories(props.snapshot);
  for (const directory of new Set([
    ...leftDirectories.keys(),
    ...rightDirectories.keys(),
  ])) {
    if (leftDirectories.get(directory) !== rightDirectories.get(directory)) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "directory-membership-changed",
        path: directory,
      });
    }
  }

  /** Record membership events and preserve the tracker overflow indication. */
  const recordTracker = (
    tracker: TtscProjectMutationTracker | undefined,
    kind: string,
  ): void => {
    if (tracker?.membershipChanged !== true) return;
    if (tracker.changes.size === 0) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind,
        path: props.projectRoot,
      });
      return;
    }
    for (const changed of tracker.changes) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind,
        path: changed,
      });
    }
    if (tracker.changesOmitted) {
      failures.omitted = Math.min(
        Number.MAX_SAFE_INTEGER,
        failures.omitted + 1,
      );
    }
  };
  recordTracker(props.tracker, "project-membership-event");

  if (failures.entries.length === 0) {
    recordGenerationProofFailure(failures, {
      domain: "project",
      kind: "snapshot-incomplete",
      path: props.projectRoot,
    });
  }
}
