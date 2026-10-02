import { resolveFilesystemPath } from "./resolveFilesystemPath";

/**
 * Lexically normalize a project-input path on the host platform; the
 * project-input name of {@link resolveFilesystemPath}.
 *
 * @evidence contracts/common.md#principled-implementation Direct delegation gives project paths the same lexical semantics as other native paths; it performs no physical identity comparison.
 * @evidence contracts/common.md#clear-and-simple-design The domain-named entry point retains one shared normalization owner without a second project-specific algorithm.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No project spelling or fixture is special-cased; the supported lexical boundary handles the input.
 * @evidence contracts/common.md#meaningful-documentation The concise native description identifies lexical scope and links its shared owner, with a blank line before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Host path normalization delegates Windows extended aliases and POSIX separators to resolveFilesystemPath; it does not infer a volume's case behavior.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Delegated local/returned path strings have no independent historical population or native resource lifetime owned by this domain adapter.
 * @evidence contracts/performance.md#efficient-algorithms The shared lexical owner traverses path text and segments and may use current-directory resolution for relative inputs; one forwarding call does not remove that delegated cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This domain adapter coordinates no cross-request work; it delegates a current lexical normalization without holding a result cache.
 */
export function resolveProjectInputPath(location: string): string {
  return resolveFilesystemPath(location);
}
