import type { NoSubstitutionTemplateLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NoSubstitutionTemplateLiteral}: a backtick template string
 * with no `${...}` substitutions.
 *
 * The `text` is the cooked content between the backticks. Because there are no
 * placeholders, the whole literal is a single span. The optional `rawText`
 * carries the source spelling before escape processing; the printer emits it
 * verbatim when present, and otherwise escapes the cooked `text` so it
 * re-parses to the same value.
 *
 * With `text` of `hello`, this prints:
 *
 * ```ts
 * `hello`
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Cooked text and optional raw spelling populate distinct template fields.
 *   With no substitutions this node represents the entire backtick literal.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Both representations stay in one outline; the printer chooses raw or
 *   escaped cooked text without a second template parsing stage here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   rawText is the explicit spelling contract, not a post-print output patch.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes cooked/raw content and the absence of substitutions;
 *   example and tags are separated under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param rawText The source spelling before escape processing, if supplied.
 * @returns The created node.
 */
export const createNoSubstitutionTemplateLiteral = (
  text: string,
  rawText?: string,
): NoSubstitutionTemplateLiteral =>
  make("NoSubstitutionTemplateLiteral", { text, rawText });
