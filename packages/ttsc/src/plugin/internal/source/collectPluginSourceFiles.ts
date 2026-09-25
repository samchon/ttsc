import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";

/**
 * The files of one plugin source directory that a plugin build keys its binary
 * on, as absolute paths in sorted order.
 *
 * Every regular file below the directory counts, except those in a directory
 * that never contributes plugin source (`node_modules`, `.git`, `.ttsc`), local
 * build residue (generated workspace files, package tarballs, editor sidecars),
 * and editor backups ending in `~`. The one reading of that rule: the cache key
 * hashes these files (`computeCacheKey`), and the transform envelope reports
 * their digest (`pluginSourceDigest`) within each directory's state
 * (`pluginSourceState`), so the two cannot disagree about what a plugin's
 * source is (samchon/ttsc#1487). A consumer that keeps a digest while the
 * metadata of these files holds still, rather than reading their bytes on every
 * proof, stats exactly this list, through the `ttsc/plugin-source` entry.
 *
 * A link (a symbolic link or a Windows junction) outside those directories is
 * refused rather than skipped. The build would compile what it names, which
 * neither this list nor anything keyed on it covers (samchon/ttsc#1506); a Go
 * module zip excludes links from a module's content for the same reason.
 *
 * @param root The source directory: a plugin's Go module root, an overlay
 *   module, a contributor's source, or a `replace` target outside the module.
 * @throws When the directory holds a link the build would read.
 */
export function collectPluginSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, root, out);
  out.sort();
  return out;
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
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
