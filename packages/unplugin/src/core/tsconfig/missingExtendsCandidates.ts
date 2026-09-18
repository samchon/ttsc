import path from "node:path";

/** Every exact spelling the file resolver probes for a missing config. */
export function missingExtendsCandidates(
  tsconfig: string,
  specifier: string,
): string[] {
  const candidate = path.resolve(path.dirname(tsconfig), specifier);
  // Case-sensitive, because `resolveExistingExtendsPath` appends `.json`
  // unless the spelling already ends in exactly that suffix.
  return candidate.endsWith(".json")
    ? [candidate]
    : [candidate, `${candidate}.json`];
}
