import fs from "node:fs";
import path from "node:path";

/**
 * Reads authored text fixtures without evaluating their source or
 * configuration.
 */
export namespace FixtureFiles {
  /**
   * Read a package's scenario tree as relative paths and exact UTF-8 contents.
   *
   * This reader owns text inputs only. Go input sets live under their product
   * package's test fixtures. Native fixture copies retain their own
   * byte-preserving copier, and links are created explicitly by their
   * scenarios.
   *
   * @evidence contracts/common.md#principled-implementation Each regular fixture file contributes its actual UTF-8 contents under the path relative to its scenario root; source/configuration text is never evaluated by the reader.
   * @evidence contracts/common.md#clear-and-simple-design One directory traversal replaces authored file maps; scenario identity selects the checked-in inputs and callers retain project and process ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No expected compiler output or consumer result is synthesized. Unsupported links and nonregular entries fail instead of silently disappearing from the input population.
   * @evidence contracts/common.md#meaningful-documentation Describes relative-path text reading and distinguishes byte-preserving copies and explicitly created native links.
   * @evidence contracts/portability.md#os-neutral-implementation Node path operations address actual files while returned map keys use portable slash separators. Relative scenario identities cannot escape the authored fixture root.
   * @evidence contracts/performance.md#efficient-algorithms Visits each scenario directory and file once; memory scales with its authored UTF-8 input bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work Reads current committed inputs at assembly without caching mutable filesystem contents or compiler verdicts. Shared expensive product preparation remains with the owning experiment.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous filesystem operations retain no open handles after returning; the resulting finite file map belongs to the caller and creates no temporary root or process.
   */
  export function read(
    scenario: string,
    owner?: "ttsc" | "unplugin",
  ): Record<string, string> {
    const fixtures =
      owner === undefined
        ? path.resolve(import.meta.dirname, "../../fixtures")
        : path.resolve(
            import.meta.dirname,
            "../../../../packages",
            owner,
            "test/fixtures/e2e",
          );
    const root = path.resolve(fixtures, scenario);
    const relative = path.relative(fixtures, root);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Fixture scenario escapes its owner: " + scenario);
    const entries: Array<[string, string]> = [];
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const location = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(location);
        else if (entry.isFile())
          entries.push([
            path.relative(root, location).split(path.sep).join("/"),
            fs.readFileSync(location, "utf8"),
          ]);
        else throw new Error("Text fixture is not a regular file: " + location);
      }
    };
    visit(root);
    return Object.fromEntries(entries);
  }
}
