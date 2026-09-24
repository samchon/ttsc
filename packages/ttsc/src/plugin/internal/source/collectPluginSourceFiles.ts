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
 * source is (samchon/ttsc#1487).
 *
 * @param root The source directory: a plugin's Go module root, an overlay
 *   module, or a contributor's source.
 */
export function collectPluginSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, out);
  out.sort();
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (GoSourceInputs.shouldPruneDirectory(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (GoSourceInputs.shouldOmitSourceFile(entry.name)) continue;
    if (entry.name.endsWith("~")) continue;
    out.push(full);
  }
}
