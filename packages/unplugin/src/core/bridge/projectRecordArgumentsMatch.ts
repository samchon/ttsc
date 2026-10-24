import { captureCompilerArguments } from "../transform/tsconfig/captureCompilerArguments";
import { resolveCompilerEnvironment } from "../transform/tsconfig/resolveCompilerEnvironment";
import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Require a record's captured invocation to match the current host context.
 *
 * A supplied identity describes the active adapter's explicit override too.
 * Generic detached readers instead replay the recorded override against current
 * inheritance. Older records lack that authority and require a new delivery.
 *
 * @evidence contracts/common.md#principled-implementation Recorded effective arguments must match the active context or a current derivation using the recorded override; absent witnesses never certify unknown prior arguments.
 * @evidence contracts/common.md#clear-and-simple-design One predicate serves detached proof and watching bridge admission before filesystem evidence can authorize host cache restoration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed inherited transport declines reuse rather than restoring a result compiled under different permission.
 * @evidence contracts/common.md#meaningful-documentation Native prose states active versus generic comparison and legacy migration.
 * @evidence contracts/portability.md#os-neutral-implementation The shared environment owner applies native Windows name selection and preserves argv/cwd spelling without platform guesses.
 * @evidence contracts/performance.md#efficient-algorithms An active digest requires scalar comparison; generic replay additionally snapshots environment keys and encodes/hashes argument bytes through existing owners.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current inheritance is observed on each generic proof; no prior environment verdict is retained.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local environment/encoding data is allocated; the record owner retains the witness.
 */
export function projectRecordArgumentsMatch(
  record: TtscProjectRecord,
  currentIdentity?: string,
): boolean {
  if (record.compilerArguments === undefined) return false;
  try {
    return (
      record.compilerArguments.identity ===
      (currentIdentity ??
        captureCompilerArguments(
          resolveCompilerEnvironment(record.compilerArguments.runExternalCode),
        ).identity)
    );
  } catch {
    return false;
  }
}
