import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../E2ETrace";
import { OwnedSynchronousProcess } from "../OwnedSynchronousProcess";
import { parseWindowsDirectoryCaseSensitivity } from "../parseWindowsDirectoryCaseSensitivity";
import type { FilesystemPathIdentityOperations } from "./FilesystemPathIdentityOperations";
import { resolveFilesystemPath } from "./resolveFilesystemPath";

/**
 * Create one unit of work's directory case-policy observations: a function that
 * answers whether a directory's names are case-sensitive, asking the filesystem
 * once per directory for as long as the unit keeps it.
 *
 * An identity context memoizes case answers for itself, but a unit of work that
 * creates several contexts, such as one watch decision, asked each directory
 * once per context. On Windows an inconclusive directory, one that is empty or
 * whose names carry no ASCII case, costs an `fsutil` process per question, and
 * one decision asked the same directory up to seventeen times
 * (samchon/ttsc#1742). Contexts created with this function as their
 * `caseSensitive` operation share its answers.
 *
 * The answers are observations of the moment they were asked, like a context's
 * own. The unit's owner chooses their lifetime; a later unit creates new
 * observations rather than reusing these. A directory's flag can change while
 * it is empty, so an answer outliving its unit could be stale.
 *
 * Unavailable evidence is `undefined`: an unreadable directory, a failed query,
 * or a platform without a read-only probe for an inconclusive directory. Only
 * observed insensitivity permits ASCII folding.
 *
 * @param operations Replaceable filesystem primitives; omitted members use the
 *   host's own.
 * @evidence contracts/common.md#principled-implementation Alternate-name observations decide first; a rejected alternate is conclusive only while its original exists. Darwin walks same-device names for its volume-wide policy and Windows asks fsutil's read-only per-directory flag. Failed observation stays unknown.
 * @evidence contracts/common.md#clear-and-simple-design One returned function owns the probe and its per-unit memo; identity resolution stays with the contexts that call it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No answer is inferred from the OS name, and no answer is carried beyond the unit that observed it.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain sharing, lifetime, the empty-directory hazard and unknown evidence, with tags separated.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath, lstat and readdir observe alternate names; darwin and win32 select their read-only volume or directory probes, and the platform's path dialect keys the memo.
 * @evidence contracts/performance.md#efficient-algorithms A miss enumerates the directory's immediate entries and stops at the first conclusive alternate; darwin can walk same-device ancestors and Windows can launch directory and volume fsutil queries. A hit is one map lookup.
 * @evidence contracts/performance.md#reuse-equivalent-work Every context of one unit shares each directory's answer, so a unit asks the filesystem once per directory instead of once per context.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The memo holds one entry per queried directory without eviction for the unit's lifetime; releasing the returned function releases it. Probes hold no handle after returning, and a Windows query has no explicit timeout.
 */
export function createCaseSensitivityObservations(
  operations: Partial<
    Pick<
      FilesystemPathIdentityOperations,
      "lstat" | "platform" | "readdir" | "realpath"
    >
  > = {},
): (directory: string) => boolean | undefined {
  const platform = operations.platform ?? process.platform;
  const probes = {
    lstat: operations.lstat ?? fs.lstatSync,
    readdir: operations.readdir ?? fs.readdirSync,
    realpath: operations.realpath ?? physicalRealpath,
  };
  const answers = new Map<string, boolean | undefined>();
  return (directory) => {
    const key = resolveFilesystemPath(directory, platform);
    if (answers.has(key)) return answers.get(key);
    let answer: boolean | undefined;
    try {
      answer = filesystemDirectoryIsCaseSensitive(key, platform, probes);
    } catch {
      // A failed capability observation is unknown. This does not suppress
      // strict physical identity errors in a context's realpath resolver.
      answer = undefined;
    }
    answers.set(key, answer);
    return answer;
  };
}

function physicalRealpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function filesystemDirectoryIsCaseSensitive(
  directory: string,
  platform: NodeJS.Platform,
  operations: {
    lstat(location: string): fs.Stats | fs.BigIntStats;
    readdir(directory: string): string[];
    realpath(location: string): string;
  },
): boolean | undefined {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  let entries: string[];
  try {
    entries = operations.readdir(directory);
  } catch {
    return undefined;
  }
  const foldedNames = new Map<string, string>();
  for (const name of entries) {
    const folded = foldAsciiCase(name);
    const previous = foldedNames.get(folded);
    if (previous !== undefined && previous !== name) return true;
    foldedNames.set(folded, name);
  }
  for (const name of entries) {
    const alternate = alternateCase(name);
    if (alternate === name) continue;
    try {
      operations.lstat(pathApi.join(directory, alternate));
    } catch (error) {
      if (isMissingFilesystemEntry(error)) {
        // Enumeration is not an atomic snapshot. An absent alternate proves
        // sensitivity only if the original spelling still names an entry.
        try {
          operations.lstat(pathApi.join(directory, name));
          return true;
        } catch (originalError) {
          if (isMissingFilesystemEntry(originalError) === false)
            throw originalError;
        }
        continue;
      }
      throw error;
    }
    try {
      const actual = resolveFilesystemPath(
        operations.realpath(pathApi.join(directory, name)),
        platform,
      );
      const alias = resolveFilesystemPath(
        operations.realpath(pathApi.join(directory, alternate)),
        platform,
      );
      return actual !== alias;
    } catch (error) {
      if (isMissingFilesystemEntry(error) === false) throw error;
    }
  }
  if (platform === "darwin") {
    // APFS/HFS case semantics are volume-wide. An empty directory has no child
    // name to probe, so ask the same read-only question of its existing name in
    // the parent and walk upward until a name with ASCII case is available.
    // This avoids a write probe while still distinguishing default APFS from a
    // case-sensitive volume.
    let current = resolveFilesystemPath(directory, platform);
    while (true) {
      const parent = pathApi.dirname(current);
      if (parent === current) break;
      // Names are interpreted by their parent; another mount is not evidence
      // of the directory's own volume case policy.
      if (operations.lstat(current).dev !== operations.lstat(parent).dev)
        return undefined;
      const name = pathApi.basename(current);
      const alternate = alternateCase(name);
      if (alternate !== name) {
        try {
          const actual = resolveFilesystemPath(
            operations.realpath(current),
            platform,
          );
          const alias = resolveFilesystemPath(
            operations.realpath(pathApi.join(parent, alternate)),
            platform,
          );
          return actual !== alias;
        } catch (error) {
          if (isMissingFilesystemEntry(error) === false) throw error;
        }
      }
      current = parent;
    }
    return undefined;
  }
  if (platform !== "win32") return undefined;
  // Node does not expose the Windows per-directory flag. Prefer fsutil's
  // read-only answer; unavailable capability remains unknown.
  const queried = queryWindowsDirectoryCaseSensitivity(directory);
  if (queried !== undefined) return queried;
  return undefined;
}

/**
 * Read the per-directory flag without depending on fsutil's display language.
 *
 * English output is cheap to recognize directly. Other Windows locales write
 * console-code-page bytes that Node cannot reliably decode, so their raw
 * message is interpreted against the volume-root query.
 */
function queryWindowsDirectoryCaseSensitivity(
  directory: string,
): boolean | undefined {
  const result = queryWindowsDirectoryCaseSensitivityBytes(directory);
  if (result === undefined) return undefined;
  const volumeRoot = path.win32.parse(directory).root;
  const direct = parseWindowsDirectoryCaseSensitivity(
    result,
    undefined,
    volumeRoot,
  );
  if (direct !== undefined) return direct;
  const volume = queryWindowsDirectoryCaseSensitivityBytes(volumeRoot);
  return parseWindowsDirectoryCaseSensitivity(result, volume, volumeRoot);
}

function queryWindowsDirectoryCaseSensitivityBytes(
  directory: string,
): Buffer | undefined {
  const args = ["file", "queryCaseSensitiveInfo", directory];
  const result = E2ETrace.synchronous(
    "fsutil.exe",
    args,
    {},
    "path-case-probe",
    () =>
      OwnedSynchronousProcess.launch("fsutil.exe", args, {
        windowsHide: true,
      }) ?? childProcess.spawnSync("fsutil.exe", args, { windowsHide: true }),
  );
  return result.error === undefined &&
    result.status === 0 &&
    Buffer.isBuffer(result.stdout)
    ? result.stdout
    : undefined;
}

function alternateCase(value: string): string {
  return value.replace(/[A-Za-z]/g, (character) =>
    character === character.toLowerCase()
      ? character.toUpperCase()
      : character.toLowerCase(),
  );
}

/** ASCII folding is the case equivalence observed by the read-only probes. */
function foldAsciiCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function isMissingFilesystemEntry(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
