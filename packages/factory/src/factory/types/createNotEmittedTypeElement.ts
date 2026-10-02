import type { NotEmittedTypeElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NotEmittedTypeElement}: a placeholder type-element that
 * carries no syntax of its own.
 *
 * It occupies a member-list slot without contributing syntax. The node has no
 * source-position fields. In an interface, a type literal or a mapped type, a
 * placeholder without comments prints nothing and leaves no separator or blank
 * line. Synthetic comments can be attached explicitly; the printer then emits
 * just those comments, with no `;` of its own.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The NotEmittedTypeElement discriminant represents an empty member body;
 *   explicit synthetic comment metadata is distinct from nonexistent source positions.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A zero-field placeholder uses the same node/comment pipeline as other
 *   members, with no special raw-text or position carrier.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The empty body is the documented node purpose, not conditional suppression
 *   of a real member's syntax or a fixture-specific omission.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states the lack of source positions and distinguishes empty
 *   syntax from explicitly attached comments, without promising inherited metadata. The rule that a placeholder without comments leaves no separator or blank line is stated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link NotEmittedTypeElement}.
 */
export const createNotEmittedTypeElement = (): NotEmittedTypeElement =>
  make("NotEmittedTypeElement", {});
