import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";

/**
 * Anchor a single `paths` target at `baseDir` unless it is already absolute,
 * normalizing to forward slashes. The `*` wildcard survives `path.resolve` as a
 * literal segment, so patterns like `./src/*` stay patterns.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared template resolver anchors ordinary targets at their declaring
 *   directory and configDir targets at the consumer; slash conversion preserves globs.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter adds only the forward-slash representation required by paths
 *   output; native resolution and template policy have one separate owner.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native resolution uses Node paths and compiler separator rules; only the
 *   returned config-pattern representation converts separators to forward slashes.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No alias name or consumer directory is special-cased during anchoring.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the base, absolute target behavior and surviving wildcard,
 *   giving callers the nonobvious facts needed for config-derived patterns.
 */
export function absolutizePathsTarget(
  baseDir: string,
  target: string,
  configDir: string = baseDir,
): string {
  const resolved = resolveConfigDirTemplatePath(baseDir, target, configDir);
  return resolved.replace(/\\/g, "/");
}
