import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";

/**
 * Anchor a single `paths` target at `baseDir` unless it is already absolute,
 * normalizing to forward slashes. The `*` wildcard survives `path.resolve` as a
 * literal segment, so patterns like `./src/*` stay patterns.
 */
export function absolutizePathsTarget(
  baseDir: string,
  target: string,
  configDir: string = baseDir,
): string {
  const resolved = resolveConfigDirTemplatePath(baseDir, target, configDir);
  return resolved.replace(/\\/g, "/");
}
