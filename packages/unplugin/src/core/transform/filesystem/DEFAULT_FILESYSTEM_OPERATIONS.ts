import fs from "node:fs";
import path from "node:path";

import type { TtscTransformFilesystemOperations } from "./TtscTransformFilesystemOperations";

/**
 * The host filesystem, expressed as the operations every generation proof uses.
 *
 * Synchronous on purpose: a proof compares a before and an after observation,
 * and nothing may interleave between them on the same turn. `lstat` and
 * `statBigInt` read `bigint` stats for nanosecond precision, while `stat` keeps
 * the ordinary form for classification only. `realpath` uses the native form so
 * Windows short names expand to observed physical spelling. Watch events may
 * still report a short or long name, so that expansion alone cannot qualify an
 * event-name filter.
 */
export const DEFAULT_FILESYSTEM_OPERATIONS: TtscTransformFilesystemOperations =
  Object.freeze({
    exists: fs.existsSync,
    readlink: (location: string | Buffer) =>
      fs.readlinkSync(location, { encoding: "buffer" }),
    readdirRaw: readRawDirectory,
    lstat: (location: string) => fs.lstatSync(location, { bigint: true }),
    readFile: (location: string) => fs.readFileSync(location),
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
    realpath: fs.realpathSync.native,
    stat: fs.statSync,
    statBigInt: (location: string) => fs.statSync(location, { bigint: true }),
  });

/**
 * Read names as native bytes and classify each entry without following links.
 * The raw-name and withFileTypes combination is not a common Dirent contract
 * across supported runtimes. Separate byte listing and lstat keep that boundary
 * explicit; errors still refuse the caller's generation proof.
 *
 * @evidence contracts/common.md#principled-implementation Native byte names and non-following lstat supply each Dirent name and kind independently of runtime-specific raw Dirent representations.
 * @evidence contracts/common.md#clear-and-simple-design One default filesystem adapter normalizes the raw listing; predicate encoding and explicit overrides remain with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No UTF8 name conversion, inferred kind, missing-entry fallback or runtime-specific fixture branch substitutes for a native observation.
 * @evidence contracts/common.md#meaningful-documentation Explains the two-query boundary and propagation of observation errors.
 * @evidence contracts/portability.md#os-neutral-implementation Native separators join Buffer paths without decoding names, and lstat distinguishes links from their targets on the observed filesystem.
 * @evidence contracts/performance.md#efficient-algorithms One listing and one lstat per entry cost O(n) native queries and O(total name bytes) retained name storage; predicate sorting remains unchanged.
 * @evidence contracts/performance.md#reuse-equivalent-work Each proof observes current membership and kind; this adapter adds no cache whose validity could outlive those inputs.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous filesystem calls release their handles before returning; the caller owns the returned entry array.
 */
function readRawDirectory(location: string): fs.Dirent<Buffer>[] {
  const prefix = Buffer.from(
    location.endsWith(path.sep) ? location : location + path.sep,
  );
  return fs.readdirSync(location, { encoding: "buffer" }).map((name) => {
    const stats = fs.lstatSync(Buffer.concat([prefix, name]));
    return {
      name,
      parentPath: location,
      path: location,
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      isSymbolicLink: () => stats.isSymbolicLink(),
      isBlockDevice: () => stats.isBlockDevice(),
      isCharacterDevice: () => stats.isCharacterDevice(),
      isFIFO: () => stats.isFIFO(),
      isSocket: () => stats.isSocket(),
    };
  });
}
