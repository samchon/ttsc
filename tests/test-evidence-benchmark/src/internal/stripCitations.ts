import fs from "node:fs";
import path from "node:path";

/**
 * Removes every `@evidence` and `@evidenceExclude` tag under a directory.
 *
 * The Evidence overlay ships one real citation: its e2e test cites the single
 * published operation. That is correct for a delivered workspace and useless
 * for observing a population, because a satisfied obligation and an obligation
 * that does not exist both report nothing — which is the whole reason an empty
 * population passes for coverage. Taking the citation away puts the workspace
 * in the state every measured cell actually starts from: evidence owed, nothing
 * acknowledged.
 *
 * Only a tag opening a JSDoc line is removed. The overlay's exclusion carriers
 * describe the tags in prose and inside backticks, and those are documentation
 * for the cell rather than citations.
 */
export const stripCitations = (directory: string): void => {
  for (const file of walk(directory)) {
    const source: string = fs.readFileSync(file, "utf8");
    const stripped: string = source
      .split("\n")
      .filter((line) => !/^\s*\*\s*@evidence(Exclude)?\s/.test(line))
      .join("\n");
    if (stripped !== source) fs.writeFileSync(file, stripped, "utf8");
  }
};

const walk = (directory: string): string[] => {
  const found: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location: string = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(location));
    else if (entry.isFile() && entry.name.endsWith(".ts")) found.push(location);
  }
  return found;
};
