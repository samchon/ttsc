import type { ServerProcessOptions } from "./ServerProcessOptions";

/**
 * The launch command, argument vector and optional process options passed to
 * the language client.
 *
 * Undefined options retain the client defaults; prepared options preserve
 * project cwd and toolchain environment.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The command, args and options match vscode-languageclient's executable
 *   input. Undefined options retain client defaults rather than manufacturing
 *   a working directory or environment.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This final transport record composes prepared command and process state
 *   without adding another launch policy or storing a live child process.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes the language-client command, vector and optional
 *   prepared options; the type comment explains client defaults and project
 *   environment ownership. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The command and argument vector retain the selected native launcher or
 *   command processor. Prepared options carry the project cwd, environment
 *   and Windows verbatim payload mode to the language-client spawn boundary;
 *   absent options preserve that client's defaults.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ServerExecutable is a type definition with no computation to cost.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ServerExecutable is a type definition and coordinates no work across
 *   requests.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ServerExecutable is a type definition and owns no state, handle or task.
 */
export type ServerExecutable = {
  /** Arguments forwarded to the selected launcher. */
  args: string[];

  /** Executable or command processor selected by the launch preparation. */
  command: string;

  /** Prepared spawn state, or undefined to retain client defaults. */
  options: ServerProcessOptions | undefined;
};
