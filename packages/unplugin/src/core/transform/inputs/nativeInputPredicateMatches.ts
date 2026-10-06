import { createHash } from "node:crypto";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { sameHostInputRealpath } from "./sameHostInputRealpath";

/**
 * One versioned native input predicate borrowed from the compiler result schema.
 *
 * @evidence contracts/common.md#principled-implementation The indexed alias retains the producer schema instead of maintaining a second kind union.
 * @evidence contracts/common.md#clear-and-simple-design This local alias names one element used by the replay function.
 * @evidenceExclude contracts/common.md#prohibited-implementation-shortcuts A type alias executes no fallback or behavior.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the versioned input and shared schema owner.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type alias performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias owns no reusable work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias owns no retained state.
 */
type Predicate = NonNullable<ITtscCompilerTransformation.IInputObservation["nativePredicates"]>[number];

/**
 * Replay the native contributor/config predicate's versioned byte encoding.
 * File hashes, directory membership, link-entry kinds and optional-file state
 * are separate operations. Errors or unavailable byte-preserving capabilities
 * refuse reuse; no later observation repairs producer identityStable=false.
 *
 * @evidence contracts/common.md#principled-implementation Each versioned kind uses the producer's original byte encoding and independently compares the reported physical identity before admitting equality.
 * @evidence contracts/common.md#clear-and-simple-design One kind-dispatched replay keeps native config fingerprints separate from decoded compiler text and legacy directory markers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown capabilities, query errors and unstable producer identity return false rather than guessing missing inputs or replacing consumed evidence with current hashes.
 * @evidence contracts/common.md#meaningful-documentation Native prose specifies distinct encodings and fail-closed capability behavior with separated tags.
 * @evidence contracts/portability.md#os-neutral-implementation Replay uses the supplied native filesystem and its platform path dialect, retains byte filenames and link text, and compares identity using observed path capabilities rather than OS-name casing assumptions.
 * @evidence contracts/performance.md#efficient-algorithms File kinds hash the selected raw bytes; directory kinds serialize and byte-sort only returned entries, with link text queried only for links. Cost includes member/name/link bytes, content bytes, native metadata and physical identity queries, with no unbounded unrelated tree traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation replays one supplied predicate and owns no shared work or cross-request cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Byte buffers and member records are call-local and no descriptor, watcher or task is retained.
 */
export function nativeInputPredicateMatches(
  file: string,
  predicate: Predicate,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
): boolean {
  if (predicate.version !== 1 || !predicate.identityStable) return false;
  const hash = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
  const missing = (error: unknown): boolean => typeof error === "object" && error !== null &&
    ("code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR"));
  const platform = filesystem.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  try {
    let currentPhysical: string | null;
    try { currentPhysical = filesystem.realpath(file); }
    catch (error) { if (!missing(error)) return false; currentPhysical = null; }
    if (!sameHostInputRealpath(predicate.realpath, currentPhysical, identities)) return false;
    let digest: string;
    if (predicate.kind === "file") {
      digest = hash(filesystem.readFile(file));
    } else if (predicate.kind === "optional-file") {
      try {
        digest = filesystem.stat(file).isFile()
          ? hash(Buffer.concat([Buffer.from("file\0"), filesystem.readFile(file)]))
          : hash("missing\0");
      } catch (error) { if (!missing(error)) return false; digest = hash("missing\0"); }
    } else if (predicate.kind === "entry") {
      try {
        const entry = filesystem.lstat(file);
        if (entry.isSymbolicLink()) {
          if (filesystem.readlink === undefined) return false;
          digest = hash(Buffer.concat([Buffer.from("symlink\0"), filesystem.readlink(file)]));
        } else {
          const kind = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other";
          digest = hash(kind + "\0");
        }
      } catch (error) { if (!missing(error)) return false; digest = hash("missing\0"); }
    } else if (predicate.kind === "directory") {
      const records: Buffer[] = [];
      if (platform === "win32") {
        for (const entry of filesystem.readdir(file)) {
          let target: Buffer = Buffer.alloc(0);
          if (entry.isSymbolicLink()) {
            if (filesystem.readlink === undefined) return false;
            target = Buffer.from(filesystem.readlink(pathApi.join(file, entry.name)).toString("utf8"), "utf8");
          }
          const kind = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symlink" : "other";
          records.push(Buffer.concat([Buffer.from(entry.name), Buffer.from("\0" + kind + "\0"), target]));
        }
      } else {
        if (filesystem.readdirRaw === undefined) return false;
        for (const entry of filesystem.readdirRaw(file)) {
          let target: Buffer = Buffer.alloc(0);
          if (entry.isSymbolicLink()) {
            if (filesystem.readlink === undefined) return false;
            target = filesystem.readlink(Buffer.concat([Buffer.from(file), Buffer.from(pathApi.sep), entry.name]));
          }
          const kind = entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symlink" : "other";
          records.push(Buffer.concat([entry.name, Buffer.from("\0" + kind + "\0"), target]));
        }
      }
      records.sort(Buffer.compare);
      digest = hash(Buffer.concat(records.flatMap((record, index) => index === 0 ? [record] : [Buffer.from([0]), record])));
    } else return false;
    return digest === predicate.digest;
  } catch { return false; }
}
