import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * The policy and the walk both spell the project root as it was named, while a
 * native Windows watcher expands its short names, and a package `extends`
 * anchors its specs physically. Match each equivalent project-root spelling
 * without following child links. Keep patterns intact: a glob can begin above
 * the root, and configDir can retain the requested spelling even when a base
 * config uses the physical one.
 */
export function rootSpellings(
  location: string,
  policy: ITtscProjectMembershipPolicy,
): string[] {
  const resolved = path.resolve(location);
  const root = policy.rootFileSpecs?.root;
  if (root === undefined) return [resolved];
  const spellings = [
    ...new Set([root.path, root.realpath, root.nativepath ?? root.realpath]),
  ];
  for (const spelling of spellings) {
    const relative = path.relative(spelling, resolved);
    if (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
      return spellings.map((candidate) => path.resolve(candidate, relative));
  }
  return [resolved];
}
