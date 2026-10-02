/**
 * Node spawn options with a working directory, environment and optional
 * verbatim Windows arguments.
 *
 * Only prequoted command-shim payloads require verbatim arguments; ordinary
 * executable arguments retain Node escaping.
 *
 * @evidence contracts/common.md#principled-implementation
 *   cwd and env match Node spawn options. An optional verbatim flag preserves
 *   the distinction between prequoted Windows shim payloads and ordinary
 *   argument vectors, whose escaping remains Node's responsibility.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Process options are one record separate from command construction; the
 *   single optional flag exposes the only additional spawn mode required.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains cwd, environment and optional Windows verbatim
 *   arguments; the type comment limits that flag to prequoted shim payloads.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
  *
  * @evidence contracts/portability.md#os-neutral-implementation
  *   cwd carries a native working directory and env carries Node's inherited
  *   environment. The optional verbatim flag distinguishes prequoted Windows
  *   command-shim payloads from argument vectors escaped by Node; it does not
  *   infer filesystem case policy from the host OS.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   ServerProcessOptions is a type definition with no computation to cost.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   ServerProcessOptions is a type definition and coordinates no work across
  *   requests.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   ServerProcessOptions is a type definition and owns no state, handle or
  *   task.
 */
export type ServerProcessOptions = {
  /** Project working directory passed to Node spawn. */
  cwd: string;

  /** Inherited environment with an optional project toolchain override. */
  env: NodeJS.ProcessEnv;

  /**
   * Node spawn option for an already quoted Windows command payload.
   *
   * The language client forwards it despite omitting it from ExecutableOptions;
   * absence retains Node's ordinary argument escaping.
   */
  windowsVerbatimArguments?: boolean;
};
