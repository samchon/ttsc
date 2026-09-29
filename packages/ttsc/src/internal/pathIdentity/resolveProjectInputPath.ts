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
 */
export function resolveProjectInputPath(location: string): string {
  return resolveFilesystemPath(location);
}
