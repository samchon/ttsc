import { mergeProjectInputSnapshots } from "../../../../../packages/ttsc/src/compiler/internal/build/mergeProjectInputSnapshots";
import { verifyProjectInputSnapshotMerge } from "../../../../utils/src/verifyProjectInputSnapshotMerge";

/**
 * Retains the original native filesystem identity merge population.
 *
 * Actual directory junction/symlink aliases and available Windows case, short
 * and namespaced aliases carry existing and missing declarations. Windows
 * sensitive-directory preparation and Linux case-distinct fixtures remain
 * native; the original Darwin sensitive-population omission is preserved. The
 * population is shared with the installation E2E, which runs it against the
 * packed SDK's operation.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the authored mergeProjectInputSnapshots through verifyProjectInputSnapshotMerge: reverse-order canonical equality, files/globs/reload populations and exact paths, Windows missing-case folding, sensitive distinct roots and mismatched-root refusal, and sensitive populations 4/2/4/4.
 * @evidence contracts/testing.md#independent-expectations Authored native entries, independent fs.realpathSync paths and literal counts/canonical paths supply expectations. Successful fsutil preparation and distinct physical roots establish the fixture premises; these expectations do not branch on the resolver's own mode. Unavailable Windows aliases remain conditional, not certified identities.
 * @evidence contracts/testing.md#distinguishing-cases Keeps existing versus missing declarations, junction/dir-symlink versus physical paths, reversed producers, four snapshot categories, available Windows case/short/namespaced aliases, Windows insensitive missing suffixes and Windows/Linux sensitive entries. Darwin retains the original sensitive-population return.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the authored operation against private native roots and actual fsutil/cmd helpers without an installed consumer, compiler, Go build or foreign replacement; cleanup failures are retained.
 */
export function test_project_input_snapshot_merge_uses_filesystem_identities(): void {
  verifyProjectInputSnapshotMerge(mergeProjectInputSnapshots);
}
