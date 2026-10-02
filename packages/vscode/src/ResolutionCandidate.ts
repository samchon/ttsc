/**
 * A module-resolution base, server working directory and optional selected
 * project config.
 *
 * Resolution and server cwd may differ when an active file lives below its
 * project root.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Keeping resolveFrom distinct from cwd lets a nested source resolve its
 *   package while its server uses the owning config directory. Optional
 *   tsconfig distinguishes explicit selection from launcher discovery.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   These three fields express resolution and launch inputs together without
 *   retaining editor state or performing resolution inside the value.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes native module-resolution base, server cwd and
 *   optional config; the type comment explains why base and cwd can differ.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ResolutionCandidate = {
  /** Working directory for project-owned server execution. */
  cwd: string;

  /** Directory from which Node resolves the project's ttsc package. */
  resolveFrom: string;

  /** Selected config candidate; absence leaves launcher discovery enabled. */
  tsconfig?: string;
};
