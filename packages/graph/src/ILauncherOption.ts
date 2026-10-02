type OptionKind = "value" | "string" | "flag" | "boolean";

/**
 * One recognized launcher option and its accepted flag aliases.
 *
 * @evidence contracts/common.md#principled-implementation Key identifies the parsed value while aliases and kind determine accepted syntax.
 * @evidence contracts/common.md#clear-and-simple-design One definition owns aliases and parsing mode so launchers share the same parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Accepted tokens are explicit launcher grammar, not special cases for expected command output.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish result key, accepted tokens and value/flag/boolean parsing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ILauncherOption {
  /** Canonical map key shared by every alias. */
  key: string;

  /** Accepted complete option tokens, including their leading hyphens. */
  flags: readonly string[];

  /** Value requires nonempty text; string preserves native empty/dash values. */
  kind: OptionKind;
}
