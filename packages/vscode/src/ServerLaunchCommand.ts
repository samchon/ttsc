/**
 * An executable name and argument vector, with optional Windows command-shim
 * environment and verbatim flag.
 *
 * JavaScript, native executable and Windows command-shim launchers require
 * distinct supported process boundaries.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The executable and argument vector represent an unspawned command.
 *   Optional environment and verbatim state carry the cmd-specific payload
 *   that createServerExecutable must forward together.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Command preparation returns its extra spawn requirements in the same
 *   record, leaving project environment resolution to the executable adapter.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes executable, vector, shim environment and verbatim
 *   state; the type comment separates JS, native and command-shim boundaries.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
  *
  * @evidence contracts/portability.md#os-neutral-implementation
  *   command and args represent Node, native executables or the Windows
  *   command processor. Shim environment and verbatim arguments travel
  *   together so prequoted cmd payloads are not escaped as ordinary arguments.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   ServerLaunchCommand is a type definition with no computation to cost.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   ServerLaunchCommand is a type definition and coordinates no work across
  *   requests.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   ServerLaunchCommand is a type definition and owns no state, handle or
  *   task.
 */
export type ServerLaunchCommand = {
  /** Ordinary argument vector, or explicit cmd switches and quoted payload. */
  args: string[];

  /** Node executable, native launcher, or Windows command processor. */
  command: string;

  /** Private quoted-argument environment for the Windows command boundary. */
  commandShimEnvironment?: NodeJS.ProcessEnv;

  /** True only for prequoted Windows command payloads; otherwise omitted. */
  windowsVerbatimArguments?: boolean;
};
