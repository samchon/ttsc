import type { Bundle, SourceFile } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Bundle}: a container that groups several source files so they
 * can be printed together.
 *
 * The `sourceFiles` are emitted in order, each printed as its own file and
 * joined with a blank line between them. This is a simplified model of the
 * legacy bundle node: the `prepends` parameter is accepted for signature parity
 * but ignored, since this package does not model prepended emit helpers.
 *
 * Given two source files that each re-export one binding (`a` from `"./a"` and
 * `b` from `"./b"`), printing the bundle yields:
 *
 * ```ts
 * export { a } from "./a";
 *
 * export { b } from "./b";
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Bundle preserves source-file order; the outline model has no prepended
 *   emit-helper nodes, so the legacy prepends argument remains unsupported.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One sourceFiles collection groups files; each SourceFile still owns its
 *   statements and the printer owns separators between files.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Ignored prepends is a documented model limitation, not fabricated helpers.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes bundle grouping from helper prepending and gives a
 *   two-file example, with prose and tags separated under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param sourceFiles The bundled source files.
 * @param _prepends Ignored; kept for signature parity.
 * @returns The created {@link Bundle}.
 */
export const createBundle = (
  sourceFiles: readonly SourceFile[],
  _prepends?: readonly unknown[],
): Bundle => make("Bundle", { sourceFiles });
