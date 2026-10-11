import {
  type IProjectInputSnapshotForMerge,
  verifyProjectInputSnapshotMerge,
} from "../../../../../../utils/src/verifyProjectInputSnapshotMerge";

/**
 * Verifies the installed project-input snapshot merge against native filesystem
 * identities.
 *
 * The source unit
 * `test_project_input_snapshot_merge_uses_filesystem_identities` runs the same
 * population against the authored operation; this case runs the
 * `mergeProjectInputSnapshots` the packed SDK publishes.
 *
 * 1. Merge snapshots that name one project through its physical path, a link and
 *    the available Windows aliases, in both orders.
 * 2. Require one physical identity per existing or missing entry.
 * 3. Outside macOS, require case-distinct entries and roots to stay apart.
 *
 * @evidence contracts/testing.md#behavioral-verification verifyProjectInputSnapshotMerge judges the installed operation's canonical snapshots, populations, exact paths and root refusal.
 * @evidence contracts/testing.md#independent-expectations Native realpath, links, fsutil and literal populations establish the expectations independently of the operation.
 * @evidence contracts/testing.md#distinguishing-cases Existing and missing entries, every available alias kind, reversed producers and case-distinct entries are separate rows.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation passes the operation its packed SDK publishes; the case starts no compiler or product host.
 * @evidence contracts/e2e.md#necessary-boundary The packed SDK's own merge module must agree with native aliases; the source unit cannot establish what the installation publishes.
 * @evidence contracts/e2e.md#shared-execution One installation serves every installed-operation case of its entry, and one population serves both owners of the operation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared population owns a fresh fixture root and removes it in finally.
 * @evidence contracts/e2e.md#preserved-coverage Restores the installed-publication run the installation entry names, with the source unit's full population.
 */
export function case_project_input_snapshot_merge_uses_filesystem_identities(
  mergeProjectInputSnapshots: (
    projectRoot: string,
    snapshots: readonly IProjectInputSnapshotForMerge[],
  ) => IProjectInputSnapshotForMerge,
): void {
  verifyProjectInputSnapshotMerge(mergeProjectInputSnapshots);
}
