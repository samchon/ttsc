/**
 * Captured argument transport and the policy used to derive it from
 * inheritance.
 *
 * @evidence contracts/common.md#principled-implementation The digest describes actual effective argv/cwd; the optional override lets detached readers derive the same invocation under current inheritance.
 * @evidence contracts/common.md#clear-and-simple-design Two scalar facts cross generation and persisted-record boundaries without retaining environment objects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witnesses remain unknown and cannot certify an older record's invocation.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes transport identity from the override policy needed for later comparison.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The value carries an opaque digest and boolean; normalization belongs to its producer.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This interface performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This interface establishes no reuse verdict.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This interface owns no runtime resource.
 */
export interface TtscCompilerArgumentsWitness {
  /** SHA-256 of the normalized effective argv/cwd transport tuple. */
  identity: string;
  /** Explicit override; omission preserves inherited compiler arguments. */
  runExternalCode?: boolean;
}
