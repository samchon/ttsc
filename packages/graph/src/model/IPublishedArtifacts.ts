import { type ITtscCapabilityPluginResolution } from "ttsc";
import { IArtifactInputs } from "./IArtifactInputs";

/**
 * Ask the project's `@ttsc/lint` for the artifacts a citation can name, and
 * write them where `ttscgraph dump --artifacts` reads them.
 *
 * A project that configures no such plugin gets `file: null`, which is the
 * common case and not an error: the graph it produces is the graph it produced
 * before this existed, and the dump says so by not claiming the capability.
 *
 * ## Why this runs here and not in the compiler host
 *
 * The addresses a citation names — a Markdown anchor, `prisma:Sale.price`,
 * `POST:/orders` — are produced by parsers that live in the rule that owns
 * them, and re-deriving any of them in the graph producer would be a second
 * implementation of a published contract. So the units have to arrive from the
 * rule.
 *
 * They cannot arrive in-process. `ttscgraph` is the shipped per-platform
 * binary, never a per-project native host, so it can never have a linked
 * plugin; and `packages/lint` is its own Go module that deliberately carries no
 * requirement on the compiler host. What is left is the channel the host
 * already has: a plugin declares a capability and its sidecar answers a verb,
 * exactly as `lsp-hints` does. `resolveCapabilityPluginResolution` builds and
 * locates those sidecars, and it is the seam `ttscserver` already uses for
 * `capabilities.lsp`, published so a consumer outside the compiler can ask
 * too.
 *
 * Nothing here knows what `@ttsc/evidence` is. It asks a lint install for
 * whatever its configured rules published, and a project that configured none
 * gets an empty answer.
 *
 * @evidence contracts/common.md#principled-implementation Publication carries the sidecar's artifact file and the input identity captured before asking for artifacts, so later input changes can invalidate that answer.
 * @evidence contracts/common.md#clear-and-simple-design The result separates the producer exchange path, input inventory and freshness identity without embedding compiler Program state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A null file states an absent publication, not an invented artifact set or a successful compiler capability claim.
 * @evidence contracts/common.md#meaningful-documentation Native member prose explains publication absence, independent document inputs and the fingerprint's ordering role.
 */
export interface IPublishedArtifacts {
  /**
   * Path to the JSON the native producer reads, or `null` when no configured
   * plugin publishes one.
   *
   * `null` is a state rather than an absence, which is why it still carries
   * {@link inputs}. A project that adds an evidence plugin while a session is
   * running would otherwise never be reconsidered: nothing would be watched, so
   * nothing could report that the answer had changed from "none" to "some".
   */
  file: string | null;

  /**
   * Everything the answer was derived from, as paths this process can state for
   * itself.
   *
   * The artifacts describe documents the compiler's Program never read, so a
   * source edit does not move them and a document edit does not move the code
   * graph. Refreshing them is therefore a second invalidation with its own
   * inputs, and these are those inputs.
   */
  inputs: IArtifactInputs;

  /**
   * The state of {@link inputs} when the answer was produced.
   *
   * Compared against a freshly taken one to decide whether the answer is stale.
   * When it moved, nothing else in the session can tell: the compiler's own
   * invalidation watches the build universe, and none of this is in it.
   */
  fingerprint: string;

  /**
   * Owning plugin discovery proof, including successful absence. Omitted by
   * legacy callers, whose publication cannot establish discovery freshness.
   */
  discovery?: ITtscCapabilityPluginResolution;
}
