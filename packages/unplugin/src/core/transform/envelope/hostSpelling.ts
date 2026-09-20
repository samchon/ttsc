import path from "node:path";

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
 * project's configured spelling. Every comparison inside the adapter stays by
 * identity.
 *
 * @param project The project root as configured and as the filesystem resolves
 *   it; equal where the root traverses no link, which makes the answer the
 *   identity.
 * @param delivered The module the host asked to transform, as it spelled it.
 * @returns The spelling function for this delivery's inputs.
 */
export function hostSpelling(
  project: { physical: string; spelling: string },
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

function within(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
