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
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link NotEmittedTypeElement}.
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
 */
export const createNotEmittedTypeElement = (): NotEmittedTypeElement =>
  make("NotEmittedTypeElement", {});
