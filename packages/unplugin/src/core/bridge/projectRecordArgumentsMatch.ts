import { captureCompilerArguments } from "../transform/tsconfig/captureCompilerArguments";
import { resolveCompilerEnvironment } from "../transform/tsconfig/resolveCompilerEnvironment";
import { environmentInputMismatch } from "../transform/validation/environmentInputMismatch";
import type { TtscProjectRecord } from "./TtscProjectRecord";

/**
 * Require a record's captured invocation to match the current host context.
 *
 * A supplied identity describes the active adapter's explicit override too.
 * Generic detached readers instead replay the recorded override against current
 * inheritance. Older records lack that authority and require a new delivery.
 * Every environment variable the generation's plugins read must also still have
 * its recorded value, or stay unset, in the current compiler environment: the
 * record stands for output those reads produced.
 *
 * @evidence contracts/common.md#principled-implementation Recorded effective arguments must match the active context or a current derivation using the recorded override, and recorded environment reads must hold in the current compiler environment; absent witnesses never certify unknown prior arguments.
 * @evidence contracts/common.md#clear-and-simple-design One predicate serves detached proof and watching bridge admission before filesystem evidence can authorize host cache restoration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed inherited transport declines reuse rather than restoring a result compiled under different permission, and a changed environment read is not excused by matching argument transport.
 * @evidence contracts/common.md#meaningful-documentation Native prose states active versus generic comparison, environment reads and legacy migration.
 * @evidence contracts/portability.md#os-neutral-implementation The shared environment owner applies native Windows name selection and preserves argv/cwd spelling without platform guesses; recorded reads compare under the same native name rule.
 * @evidence contracts/performance.md#efficient-algorithms An active digest requires scalar comparison; generic replay additionally snapshots environment keys and encodes/hashes argument bytes through existing owners. Recorded reads add one environment snapshot and a lookup per name, only when the record carries any.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current inheritance is observed on each generic proof; no prior environment verdict is retained.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local environment/encoding data is allocated; the record owner retains the witness.
 */
export function projectRecordArgumentsMatch(
  record: TtscProjectRecord,
  currentIdentity?: string,
): boolean {
  if (record.compilerArguments === undefined) return false;
  try {
    if (
      record.compilerArguments.identity !==
      (currentIdentity ??
        captureCompilerArguments(
          resolveCompilerEnvironment(record.compilerArguments.runExternalCode),
        ).identity)
    )
      return false;
    return (
      record.environmentInputs === undefined ||
      environmentInputMismatch(
        record.environmentInputs,
        resolveCompilerEnvironment(record.compilerArguments.runExternalCode),
      ) === undefined
    );
  } catch {
    return false;
  }
}
