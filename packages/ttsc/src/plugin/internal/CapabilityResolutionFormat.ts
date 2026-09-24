import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "./source/resolveSourceBuildCachePaths";

/**
 * The on-disk format of the capability-resolution cache, shared by its reader
 * and writer so both agree on the entry's location, version tag, and how a
 * plugin source's metadata signature is taken. What proves an entry still
 * describes the project is the host inputs' states and the plugin sources'
 * states, each by the rule its producer applies.
 */
export namespace CapabilityResolutionFormat {
  /**
   * Cache format tag.
   *
   * Moves when the entry shape or the validation rule changes, so an older
   * entry is discarded rather than read under new rules. The second format
   * proves the directories the binaries were keyed on by the build's own rule,
   * where the first fingerprinted each plugin's `source` alone
   * (samchon/ttsc#1492).
   */
  const FORMAT = "ttsc-capability-resolution-v2";

  /**
   * The character that joins fields a path could otherwise forge.
   *
   * A path cannot contain it, which is the whole reason it is the separator:
   * with a space, a file named `a 1 2` states the same string as a one-byte
   * file named `a`, and an edit to either would read as no edit at all. Built
   * rather than written literally, because a source file carrying a raw NUL is
   * one Git classifies as binary — which silently exempts it from this
   * repository's end-of-line contract and leaves it with no textual diff for a
   * reviewer.
   */
  const SEPARATOR = String.fromCharCode(0);

  /**
   * The version string an entry records: the format tag joined with the ttsc
   * version, so a ttsc upgrade invalidates every entry written by another one.
   */
  export function formatVersion(version: string): string {
    return `${FORMAT}:${version}`;
  }

  /**
   * Where the entry for this project lives, or `null` when no cache root can be
   * resolved.
   *
   * Keyed on the project rather than on the capability: the walk it replaces
   * discovers every configured plugin, so one entry answers for all of them and
   * a second consumer asking about a different capability costs nothing.
   */
  export function resolutionFile(options: {
    cwd: string;
    tsconfig: string;
    env?: NodeJS.ProcessEnv;
  }): string | null {
    let root: string;
    try {
      root = resolveSourceBuildCachePaths(
        path.resolve(options.cwd),
        undefined,
        options.env ?? process.env,
      ).root;
    } catch {
      return null;
    }
    const key = crypto
      .createHash("sha256")
      .update(path.resolve(options.cwd))
      .update(SEPARATOR)
      .update(options.tsconfig)
      .digest("hex");
    return path.join(root, "capabilities", `${key}.json`);
  }

  /**
   * A clock reference for plugin source signatures, minted by a write of the
   * cache's own beside the entry: the modification stamp a fresh probe file got
   * there, by the device that reported it.
   *
   * A stamp strictly older than its device's reference lies in a clock tick
   * that has provably ended, so any later write to that file mints a newer one
   * and moves the signature; git's rule for an index entry that is not racily
   * clean. The probe is the cache's own file, named for this call, and removed
   * at once, so concurrent readers never lend each other a reference. A failed
   * write, or a plugin source on another device, leaves nothing separable, and
   * the proof reads the files.
   *
   * @param entry The entry file, whose directory the probe is written in.
   */
  export function clockReference(entry: string): ReadonlyMap<bigint, bigint> {
    const references = new Map<bigint, bigint>();
    const probe = path.join(
      path.dirname(entry),
      `clock-${process.pid}-${crypto.randomUUID()}.probe`,
    );
    try {
      fs.mkdirSync(path.dirname(probe), { recursive: true });
      fs.writeFileSync(probe, `${process.hrtime.bigint()}\n`);
      const stats = fs.lstatSync(probe, { bigint: true });
      references.set(stats.dev, stats.mtimeNs);
    } catch {
      references.clear();
    } finally {
      try {
        fs.rmSync(probe, { force: true });
      } catch {
        // A probe left behind is an empty file of the cache's own.
      }
    }
    return references;
  }

  /**
   * One plugin source file's metadata signature, and whether its stamp is
   * separable from `reference`, for `pluginSourceFilesSignature`.
   *
   * The files the digest reads are regular files (`collectPluginSourceFiles`),
   * so the file's own metadata is its whole state: a write, a replacement, or a
   * write through another hard link moves the size, the stamps, or the file
   * id.
   *
   * @param reference The clock reference minted for this proof.
   */
  export function sourceEvidence(
    reference: ReadonlyMap<bigint, bigint>,
  ): (file: string) => { separable: boolean; signature: string } | undefined {
    return (file) => {
      try {
        const stats = fs.lstatSync(file, { bigint: true });
        const minted = reference.get(stats.dev);
        return {
          separable: minted !== undefined && stats.mtimeNs < minted,
          signature: [
            stats.dev,
            stats.ino,
            stats.nlink,
            stats.mode,
            stats.size,
            stats.mtimeNs,
            stats.ctimeNs,
          ].join(":"),
        };
      } catch {
        return undefined;
      }
    };
  }
}
