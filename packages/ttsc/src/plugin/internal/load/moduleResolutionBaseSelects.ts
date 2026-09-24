import fs from "node:fs";
import path from "node:path";

/**
 * Whether a module-resolution base is the one a completed resolution selected:
 * the resolved file is the base itself, the base with one of `extensions`, its
 * manifest or an index file, or lies inside the base as a directory.
 *
 * A bare specifier is looked up in every search root in order
 * (`require.resolve.paths`), and the lookup stops at the first root whose
 * package it selects. Candidates in the roots after that one were never
 * consulted, so they cannot have steered the resolution: their appearance can
 * only matter once the selected package stops resolving, and that package is an
 * input already. The ttsx descriptor evaluator (`installRuntimeHooks`) and the
 * loader's own candidate expansion (`loadProjectPlugins`) stop at the root this
 * answers for, and the isolated CommonJS evaluator, which runs as source in a
 * clean process, applies the same rule (`candidateSelected` in
 * `COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE`), so the inputs they record are
 * exactly the paths the resolution could have read. A search root below a
 * directory whose metadata churns, such as a home directory or the shared
 * temporary directory, therefore cannot cost a descriptor its cache proof while
 * its package resolves nearer.
 *
 * Every path is compared by its physical spelling, so a package reached through
 * a link is still the one selected. A path that cannot be resolved selects
 * nothing.
 *
 * @param base The candidate base: a package directory, or a path the specifier
 *   names without its extension.
 * @param resolvedFile The file the resolution selected, or `undefined` when it
 *   failed.
 * @param extensions The extensions the evaluator's resolution probes.
 */
export function moduleResolutionBaseSelects(
  base: string,
  resolvedFile: string | undefined,
  extensions: readonly string[],
): boolean {
  if (resolvedFile === undefined) return false;
  let selected: string;
  try {
    selected = fs.realpathSync.native(resolvedFile);
  } catch {
    selected = path.resolve(resolvedFile);
  }
  const candidates = [
    base,
    ...extensions.map((extension) => base + extension),
    path.join(base, "package.json"),
    ...extensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const relative = path.relative(canonical, selected);
      if (
        relative === "" ||
        (fs.statSync(canonical).isDirectory() &&
          relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative))
      ) {
        return true;
      }
    } catch {
      // A missing candidate selects nothing.
    }
  }
  return false;
}
