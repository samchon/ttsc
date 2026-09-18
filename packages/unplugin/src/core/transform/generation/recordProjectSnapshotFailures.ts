import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { toProjectKey } from "../project/toProjectKey";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";

/** Preserve exact project-walk and mutation witnesses for one failed attempt. */
export function recordProjectSnapshotFailures(
  failures: TtscGenerationProofFailures,
  props: {
    before: ReturnType<typeof collectProjectInputSnapshot>;
    declared: ReadonlySet<string> | undefined;
    identities: FilesystemPathIdentityContext;
    projectRoot: string;
    snapshot: ReturnType<typeof collectProjectInputSnapshot>;
    tracker?: TtscProjectMutationTracker;
  },
): void {
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
