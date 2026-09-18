import path from "node:path";
import { type ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { WatchPaths } from "./WatchPaths";
import { literalGlobRoot } from "./literalGlobRoot";

/**
 * Rules for watching the inputs project rules declare beyond the TypeScript
 * Program (documents, schemas, generated sources).
 *
 * They decide which directory a declared input is observed through, whether a
 * directory still anchors any declaration after a change, and whether a
 * changed path can affect the compiler's Program rather than only a rule.
 */
export namespace ProjectInputWatchRules {
/** Whether a file extension is one TypeScript-Go compiles or emits. */
export function isCompilerEmittableSourceExtension(extension: string): boolean {
  return [
    ".cjs",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".mts",
    ".ts",
    ".tsx",
  ].includes(extension);
}

/**
 * The directory a recursive watcher for `target` should be installed on.
 *
 * A target inside the project is observed through the project's own root. One
 * outside it is observed through the nearest existing directory of its declared
 * parent, or failing that of its own tree, so a tree that does not exist yet is
 * still seen. Either candidate is refused when it contains the project, and
 * `undefined` is returned rather than watching the whole project from above.
 */
export function projectInputRecursiveWatchRoot(
  target: string,
  projectRoot: string,
  identities = createProjectInputPathIdentityContext(),
): string | undefined {
  const resolvedTarget = path.resolve(target);
  const resolvedProjectRoot = path.resolve(projectRoot);
  if (identities.isWithin(resolvedProjectRoot, resolvedTarget)) {
    return WatchPaths.nearestExistingDirectory(resolvedProjectRoot);
  }
  // An external anchor rises to the declared parent so a tree that does not
  // exist yet is still observed, and so siblings under it share one handle. It
  // may not rise past the project, though: a directory that contains the
  // project swallows the project's own root when the two are merged, and every
  // in-project declaration then rides one recursive handle over a shared system
  // directory — a temp root, or the filesystem root itself — which delivers
  // nothing. Prefer the declared parent, fall back to the target's own tree,
  // and decline rather than widen past the project.
  for (const candidate of [
    WatchPaths.nearestExistingDirectory(path.dirname(resolvedTarget)),
    WatchPaths.nearestExistingDirectory(resolvedTarget),
  ]) {
    if (candidate === undefined) continue;
    // The project root cannot outrank itself in the merge, so it is the one
    // container that is never a swallow — it is the owner the internal branch
    // would have chosen anyway. A declaration reached through an in-project
    // directory symlink lands here, and rejecting it would drop the hoist that
    // keeps a replaced directory from stranding a child handle.
    if (
      identities.resolve(candidate).key !==
        identities.resolve(resolvedProjectRoot).key &&
      identities.isWithin(candidate, resolvedProjectRoot)
    ) {
      continue;
    }
    return candidate;
  }
  return undefined;
}

/**
 * Whether `directory` contains any declaration of the snapshot: a declared
 * file, a reload file, a reload directory strictly below it, or the literal
 * root of a declared glob. A watch root that anchors nothing can be dropped.
 */
export function projectInputAnchorsDeclaration(
  snapshot: ITtscProjectInputSnapshot,
  directory: string,
  identities: ProjectInputPathIdentityContext,
): boolean {
  return (
    snapshot.files.some((file) => identities.isWithin(directory, file)) ||
    (snapshot.reloadFiles ?? []).some((file) =>
      identities.isWithin(directory, file),
    ) ||
    (snapshot.reloadDirectories ?? []).some(
      (entry) =>
        // A reload directory anchors the directory that contains it, never
        // itself. Its own fingerprint is a digest of its immediate entries, so
        // nothing below it can reach the corpus, and treating it as its own
        // anchor would rearm for every entry created directly inside it —
        // including `node_modules`, which contributors publish as one.
        identities.isWithin(directory, entry) &&
        identities.resolve(directory).key !== identities.resolve(entry).key,
    ) ||
    snapshot.globs.some((glob) =>
      identities.isWithin(directory, literalGlobRoot(glob)),
    )
  );
}

/**
 * Whether a changed project input could change the TypeScript Program: a
 * source or emittable extension, or JSON, which `resolveJsonModule` imports
 * and tsconfig files are written in.
 */
export function projectInputPathMayAffectProgram(location: string): boolean {
  const extension = path.extname(location).toLowerCase();
  return extension === ".json" || isCompilerEmittableSourceExtension(extension);
}
}
