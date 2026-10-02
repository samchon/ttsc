import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * The files of one plugin source directory that a plugin build keys its binary
 * on, as absolute paths in sorted order.
 *
 * Every regular file below the directory counts, except those in a directory
 * excluded by the snapshot policy (`node_modules`, `.git`, `.ttsc`), files
 * with excluded workspace, archive or sidecar names,
 * and editor backups ending in `~`. The one reading of that rule: the cache key
 * hashes these files (`computeCacheKey`), and the transform envelope reports
 * their digest (`pluginSourceDigest`) within each directory's state
 * (`pluginSourceState`), so the two cannot disagree about what a plugin's
 * source is. A consumer that keeps a digest while the
 * metadata of these files holds still, rather than reading their bytes on every
 * proof, stats exactly this list, through the `ttsc/plugin-source` entry.
 *
 * Selection follows ttsc's declared naming policy, not Go's EmbedFiles. Data
 * under excluded names or directories is omitted even when a raw Go package
 * can embed it. The returned population describes the materialized source
 * snapshot, not every input the original package could use.
 *
 * A link (a symbolic link or a Windows junction) outside those directories is
 * refused rather than skipped. The build would compile what it names, which
 * neither this list nor anything keyed on it covers; a Go
 * module zip excludes links from a module's content for the same reason.
 *
 * @param root The source directory: a plugin's Go module root, an overlay
 *   module, a contributor's source, or a `replace` target outside the module.
 *
 * @throws When the directory holds a link the build would read.
 * @throws When enumeration fails for a reason other than a vanished entry.
 *
 * @evidence contracts/common.md#principled-implementation The recursive Dirent walk selects reported regular files under the shared prune/omit policy and refuses contributing links observed during enumeration. The returned path list is not an atomic snapshot or a retained handle pinning each entry against later replacement; copying/content readers own their subsequent observations.
 * @evidence contracts/common.md#clear-and-simple-design One private traversal owns enumeration and one final sort establishes deterministic file order for every downstream digest.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared source rules apply the declared kind/name exclusions instead of adapting the key to observed fixtures or inferring Go dependency membership from names.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify counted files, explicit exclusions, the Go embed limitation, link rejection and the common reader used by keys and proofs.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joining and Dirent kinds distinguish ordinary files, directories and links, including junctions; neither case folding nor slash-only identity is assumed.
 * @evidence contracts/performance.md#efficient-algorithms Enumeration visits unpruned entries and sorts F selected native path strings with O(F log F) comparisons whose text length matters. Native readdir/Dirent/name/path construction and recursion also cost work; it retains complete selected path bytes and ancestor listing arrays, not file contents.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This supplies a fresh source population to its callers; cached digests and validation reuse are owned by those callers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous walk retains only the returned path list and transient recursion state, with no persistent handle or task.
 */
export function collectPluginSourceFiles(root: string): string[] {
  const out: string[] = [];
  const directory = path.resolve(root);
  walk(directory, directory, out);
  out.sort();
  return out;
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // A link where the build passes over anyway stays irrelevant. Any other
      // is refused: the build would compile what it names, which neither this
      // list, the key, nor a watch covers, and a copy of the module cannot
      // recreate a link without the symlink privilege on Windows.
      if (
        GoSourceInputs.shouldPruneDirectory(entry.name) ||
        GoSourceInputs.shouldOmitSourceFile(entry.name)
      )
        continue;
      throw new Error(
        `ttsc: plugin source ${root} contains a link at ${full}. A plugin's Go ` +
          `sources are its own files, as a Go module zip holds them: replace the ` +
          `link with the files it names, or give the linked directory a go.mod of ` +
          `its own and name it through a replace directive in the plugin's go.mod.`,
      );
    }
    if (entry.isDirectory()) {
      if (GoSourceInputs.shouldPruneDirectory(entry.name)) continue;
      walk(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (GoSourceInputs.shouldOmitSourceFile(entry.name)) continue;
    out.push(full);
  }
}
