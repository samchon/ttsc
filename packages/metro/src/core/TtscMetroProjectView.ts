import type {
  readProjectMembershipPolicy,
  TtscWatchInput,
} from "@ttsc/unplugin/api";

/**
 * One project, and the membership policy that describes it.
 *
 * The recorder's question is whether the project walk already covers an input,
 * so it needs both the walk's roots and the policy that walk used, and it is
 * wrong exactly when those two describe different projects. Passing them
 * separately made that mismatch expressible — the policy for one project
 * alongside the root of another — and passing the policy alone made it
 * expressible in a quieter way still, since a recorder that resolved its own
 * could describe a different program than the walk hashed. Both halves travel
 * together so neither can be supplied without the other (samchon/ttsc#1316).
 *
 * @evidence contracts/common.md#principled-implementation
 *   A readonly structural interface carries the selected config, discovery
 *   observations, membership policy and walk roots as one view.
 *   resolveProjectView supplies that coherent view to the recorder instead of
 *   independently resolving its parts.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The view groups config, policy, roots and discovery observations so a
 *   recorder receives one selected project rather than independently chosen
 *   pieces. Readonly members prevent replacement through this interface.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The type does not structurally prohibit an inconsistent manually
 *   constructed value; it introduces no executable branches, consumer
 *   exceptions or foreign mutation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains each readonly field, one selected project and
 *   the reason policy and roots travel together. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Declares a shape only; it holds no state, handle or buffer.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Declares a shape only; there is no loop or processing in it.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Declares a shape only; it computes nothing to share.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Carries absolute paths chosen by the project resolver; it compares or normalizes none.
 */
export interface TtscMetroProjectView {
  /** The base directory both fingerprint sides agree on. */
  readonly base: string;

  /** Config candidates observed while selecting this transform's project. */
  readonly discoveryInputs: readonly TtscWatchInput[];

  /** The caller's explicit `project`, if any. */
  readonly explicitProject: string | undefined;

  /** The membership policy resolved for that project. */
  readonly policy: ReturnType<typeof readProjectMembershipPolicy>;

  /** The policy used by the routed static walk. */
  readonly walkPolicy: ReturnType<typeof readProjectMembershipPolicy>;

  /** Lexical roots whose fingerprint uses this project's policy. */
  readonly roots: readonly string[];

  /** The exact config selected for this project. */
  readonly tsconfig: string;
}
