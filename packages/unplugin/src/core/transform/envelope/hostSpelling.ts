import path from "node:path";

import type { TtscProjectSpellings } from "../filesystem/TtscProjectSpellings";

/**
 * How a host is handed the compiler's inputs for one delivery: spelled under
 * the project as the host itself spelled the module it delivered
 * (samchon/ttsc#1451).
 *
 * The compiler reports its inputs physically, after every link. A host names
 * the project one of two ways, and says which by the module it hands over: one
 * that resolves its modules through links, as webpack's resolver and Vite's do,
 * delivers the physical path, and compares every dependency against physical
 * paths of its own; one that keeps the path it was configured with, as
 * Turbopack does, delivers that spelling, `/var/…` on macOS where the temporary
 * directory links to `/private/var/…`, or a linked workspace anywhere, and
 * refuses or duplicates a dependency spelled the other way. Handing the wrong
 * spelling made Turbopack track no dependency at all and webpack watch every
 * project directory twice. The adapter therefore speaks the spelling of the
 * delivered module: an input below either spelling of the project root is
 * returned under the one the module carries, and an input elsewhere keeps its
 * own. A module under neither, which no host names by the project, takes the
 * project's configured spelling. Containment uses native lexical path
 * relations; physical identity was established when the roots were captured.
 * The wrapper tsconfig written for the compiler takes the same
 * function with the compiler's physical root as the delivered path, since the
 * compiler is the other party the adapter spells paths for
 * (samchon/ttsc#1456).
 *
 * @param project The project root as configured and as the filesystem resolves
 *   it; equal where the root traverses no link, which makes the answer the
 *   identity.
 * @param delivered The module the host asked to transform, as it spelled it, or
 *   the root the compiler spells.
 * @returns The spelling function for this delivery's inputs.
 *
 * @evidence contracts/common.md#principled-implementation The delivered module selects which captured root spelling the host uses; rewriting only paths contained beneath the opposite root preserves project-relative suffixes and leaves external inputs unchanged.
 * @evidence contracts/common.md#clear-and-simple-design Orientation is chosen once and a returned mapper applies that one native relative-path rule; the within helper shares the same containment predicate without consulting bundler-specific configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The mapping follows two actual project root spellings and delivery context, not a named-consumer exception or patched resolver; paths outside the selected root are not coerced into the project.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain physical/configured roots, delivery selection, external paths and compiler use, and parameter/return comments document the mapper's inputs with separated acknowledgments under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation path.relative, path.sep, path.isAbsolute and path.join handle native containment, parent escape and cross-volume paths; the function uses captured physical roots without hardcoding a platform's symlink or temporary-directory layout.
 */
export function hostSpelling(
  project: TtscProjectSpellings,
  delivered: string,
): (input: string) => string {
  if (project.physical === project.spelling) return (input) => input;
  const host =
    !within(delivered, project.spelling) && within(delivered, project.physical)
      ? { from: project.spelling, to: project.physical }
      : { from: project.physical, to: project.spelling };
  return (input) => {
    const relative = path.relative(host.from, input);
    return relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
      ? input
      : path.join(host.to, relative);
  };
}

/**
 * Test native lexical containment, including the root itself.
 *
 * Parent-relative escapes and cross-volume absolute relatives are outside;
 * this check does not resolve symlinks or establish physical file identity.
 */
function within(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
