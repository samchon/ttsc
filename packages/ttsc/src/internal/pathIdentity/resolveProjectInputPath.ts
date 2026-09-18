import { resolveFilesystemPath } from "./resolveFilesystemPath";

/**
 * Lexically normalize a project-input path on the host platform; the
 * project-input name of {@link resolveFilesystemPath}.
 */
export function resolveProjectInputPath(location: string): string {
  return resolveFilesystemPath(location);
}
