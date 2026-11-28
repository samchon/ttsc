import fs from "node:fs";
import path from "node:path";

/**
 * Find each link in the supplied native paths and their first blocked
 * components. Linked mode includes an endpoint only after following a link.
 * Follow links before scanning the remaining suffix so a link in a target path
 * can be observed independently of the original alias. If supplied, the byte
 * callback receives POSIX entries that cannot round-trip through UTF-8. A
 * directory callback receives an endpoint only when the walk reached it.
 *
 * @evidence contracts/common.md#principled-implementation Native lstat and readlink expose links and blocked components. Native link expansion precedes dot-parent steps. A sixty-four-link bound stops cycles and expanding targets.
 * @evidence contracts/common.md#clear-and-simple-design Watch and LSP callers share path expansion and own their own subscriptions and fingerprints.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Access errors stop traversal without claiming another link or a missing entry.
 * @evidence contracts/common.md#meaningful-documentation States why a target path needs its own scan.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native roots and link metadata, including junctions. POSIX byte paths use Latin-1 as a reversible internal component representation and return to bytes before native observations.
 * @evidence contracts/performance.md#efficient-algorithms Walks path components and followed link spellings without listing or reading directory contents.
 * @evidence contracts/performance.md#reuse-equivalent-work Paths in one capture share observations of exact native components. Each call observes link topology afresh.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The local set and observation map live for one capture. The resulting paths transfer to the caller, with no open handles.
 */
export function pluginInputAliasEntries(
  inputs: readonly string[],
  options: {
    endpoint?: "all" | "linked";
    rawEntry?: (entry: Buffer) => void;
    directory?: (target: string) => void;
  } = {},
): string[] {
  const entries = new Set<string>();
  const observed = new Map<
    string,
    { directory: boolean; target?: string } | null
  >();
  const rawPaths =
    process.platform !== "win32" &&
    (options.rawEntry !== undefined || options.directory !== undefined);
  const separator = process.platform === "win32" ? /[\\/]/ : "/";
  for (const spelling of inputs) {
    const input = rawPaths
      ? Buffer.from(spelling).toString("latin1")
      : spelling;
    let parent = path.parse(input).root;
    let names = input.slice(parent.length).split(separator);
    let followed = 0;
    let index = 0;
    for (; index < names.length; index++) {
      const name = names[index]!;
      if (name === "" || name === ".") continue;
      if (name === "..") {
        parent = path.dirname(parent);
        continue;
      }
      const entry = path.join(parent, name);
      const observation = observe(entry);
      if (observation === null) break;
      if (observation.target !== undefined) {
        // Cap cyclic or expanding link targets. Preserve target components:
        // a preceding link must resolve before '..' chooses its parent.
        if (++followed > 64) break;
        const target = observation.target;
        const root = path.parse(target).root;
        if (root !== "") parent = path.parse(path.resolve(parent, target)).root;
        names = [
          ...target.slice(root.length).split(separator),
          ...names.slice(index + 1),
        ];
        index = -1;
        continue;
      }
      if (!observation.directory) {
        if (options.endpoint !== "linked" || followed !== 0) entries.add(entry);
        break;
      }
      parent = entry;
    }
    if (index === names.length && options.directory !== undefined)
      options.directory((rawPaths ? decode(parent) : parent) ?? spelling);
  }
  if (!rawPaths) return [...entries];
  const decoded: string[] = [];
  for (const entry of entries) {
    const file = decode(entry);
    if (file !== undefined) decoded.push(file);
    else options.rawEntry?.(Buffer.from(entry, "latin1"));
  }
  return decoded;

  function decode(entry: string): string | undefined {
    const bytes = Buffer.from(entry, "latin1");
    const file = bytes.toString();
    return Buffer.from(file).equals(bytes) ? file : undefined;
  }

  function observe(
    entry: string,
  ): { directory: boolean; target?: string } | null {
    const previous = observed.get(entry);
    if (previous !== undefined) return previous;
    let result: { directory: boolean; target?: string } | null = null;
    try {
      const native = rawPaths ? Buffer.from(entry, "latin1") : entry;
      const stat = fs.lstatSync(native, { throwIfNoEntry: false });
      result = { directory: stat?.isDirectory() === true };
      if (stat?.isSymbolicLink()) {
        entries.add(entry);
        const raw = fs.readlinkSync(native, { encoding: "buffer" });
        const target = raw.toString(rawPaths ? "latin1" : "utf8");
        result =
          rawPaths || Buffer.from(target).equals(raw)
            ? { directory: false, target }
            : null;
      }
    } catch {
      // The native refusal contributes no blocked endpoint.
      result = null;
    }
    observed.set(entry, result);
    return result;
  }
}
