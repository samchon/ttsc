import type { SourceFile, Statement } from "../../ast";
import { createSourceFile } from "./createSourceFile";

/**
 * Create a {@link SourceFile}.
 *
 * This outline replacement uses only the new statements. It does not copy the
 * old source's comments or identity, unlike a compiler update that preserves
 * source metadata. The old node is left unchanged.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Delegation constructs a new SourceFile from the replacement statements.
 *   Existing source identity/comments are not preserved by this outline API.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   SourceFile construction stays in createSourceFile; the legacy source
 *   parameter documents compatibility rather than introducing mutation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Ignoring old metadata is an explicit limitation; this does not claim to
 *   simulate a metadata-preserving compiler update.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose now explains replacement, immutability and lost metadata,
 *   separated from parameter tags and acknowledgments as documentation requires.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param _source Ignored; present only to mirror the legacy signature.
 * @param statements The statements.
 * @returns The created {@link SourceFile}.
 */
export const updateSourceFile = (
  _source: SourceFile,
  statements: readonly Statement[],
): SourceFile => createSourceFile(statements);
