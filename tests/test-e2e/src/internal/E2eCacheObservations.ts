import fs from "node:fs";
import path from "node:path";

/**
 * Observes coordinator-selected cache namespaces between joined phases. A new
 * filesystem entry is not proof of a cache miss, producer build or persisted
 * valid result. Actual cache events and prepared identity remain separate
 * observations. Observed directory links are recorded without following them.
 * The coordinator must keep these roots quiet: native path checks are not
 * atomic race protection.
 *
 * @evidence contracts/common.md#principled-implementation Compares actual native entry observations at the same explicitly selected roots; additions, removals and metadata changes are distinct from cache semantics.
 * @evidence contracts/common.md#clear-and-simple-design Capture and difference share one finite entry representation, with no implicit workspace/cache discovery or cache mutation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not infer misses from filenames, deliberately traverse observed aliases, clear caches or substitute expected entry counts for native observations.
 * @evidence contracts/common.md#meaningful-documentation States joined-phase selection, no-follow traversal and the limits of file-entry deltas as cost evidence.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat preserves file/directory/link kinds and bigint identity metadata. Path keys retain native case spelling; no OS-name equality is assumed.
 * @evidence contracts/performance.md#efficient-algorithms Visits each selected native directory entry once and indexes differences by relative path. Work and retained metadata scale with observed entries; no file content buffer is read.
 * @evidence contracts/performance.md#reuse-equivalent-work Explicit before/after snapshots serve one comparison; native state is recaptured for a later phase rather than borrowing an earlier cache verdict.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous traversal closes before return; metadata is caller-owned and grows with actual selected entries. The coordinator owns phase joins, snapshot retention and cache-root cleanup.
 */
export namespace E2eCacheObservations {
  /** Records missing roots explicitly and fails on other native IO errors. */
  export function capture(roots: readonly string[]): Snapshot {
    const selected = roots.map((root) => path.resolve(root));
    if (new Set(selected).size !== selected.length)
      throw new Error("Duplicate cache observation root");
    const result: Snapshot = {
      startedAt: new Date().toISOString(),
      finishedAt: "",
      roots: Object.create(null),
    };
    for (const root of selected) {
      const entries: Record<string, Entry> = Object.create(null);
      const pending = [root];
      while (pending.length !== 0) {
        const file = pending.pop()!;
        let stat: fs.BigIntStats;
        try {
          stat = fs.lstatSync(file, { bigint: true });
        } catch (error) {
          if (
            file === root &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
          )
            break;
          throw error;
        }
        const relative = path.relative(root, file);
        const kind = stat.isSymbolicLink()
          ? "link"
          : stat.isDirectory()
            ? "directory"
            : stat.isFile()
              ? "file"
              : "other";
        entries[relative] = {
          kind,
          dev: stat.dev.toString(),
          ino: stat.ino.toString(),
          size: stat.size.toString(),
          mode: stat.mode.toString(),
          mtimeNs: stat.mtimeNs.toString(),
          ctimeNs: stat.ctimeNs.toString(),
          ...(kind === "link" ? { link: fs.readlinkSync(file) } : {}),
        };
        if (kind === "directory")
          for (const name of fs.readdirSync(file))
            pending.push(path.join(file, name));
      }
      result.roots[root] = entries;
    }
    result.finishedAt = new Date().toISOString();
    return result;
  }

  /** Requires the same selected roots; does not call additions cache misses. */
  export function difference(before: Snapshot, after: Snapshot): Delta[] {
    const roots = Object.keys(before.roots);
    if (
      roots.length !== Object.keys(after.roots).length ||
      roots.some((root) => !Object.hasOwn(after.roots, root))
    )
      throw new Error("Cache observation roots changed between phases");
    return roots.map((root) => {
      const previous = before.roots[root]!;
      const current = after.roots[root]!;
      return {
        root,
        added: Object.keys(current)
          .filter((file) => !Object.hasOwn(previous, file))
          .sort(),
        removed: Object.keys(previous)
          .filter((file) => !Object.hasOwn(current, file))
          .sort(),
        changed: Object.keys(current)
          .filter(
            (file) =>
              Object.hasOwn(previous, file) &&
              JSON.stringify(previous[file]) !== JSON.stringify(current[file]),
          )
          .sort(),
      };
    });
  }

  /** Wall-clock bounds bracket a traversal, not an atomic filesystem snapshot. */
  export interface Snapshot {
    startedAt: string;
    finishedAt: string;
    roots: Record<string, Record<string, Entry>>;
  }

  /** Relative path entries preserve spelling and do not collapse hard links. */
  export interface Entry {
    kind: "file" | "directory" | "link" | "other";
    dev: string;
    ino: string;
    size: string;
    mode: string;
    mtimeNs: string;
    ctimeNs: string;
    link?: string;
  }

  /** Paths name actual entries; changed metadata does not identify content keys. */
  export interface Delta {
    root: string;
    added: string[];
    removed: string[];
    changed: string[];
  }
}
