import { createHash } from "node:crypto";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/** Native contributor kinds retain their producer's version-one byte codec. */
type Kind = NonNullable<
  ITtscCompilerTransformation.IInputObservation["nativePredicates"]
>[number]["kind"];

/**
 * Observe one native predicate's current byte digest and physical target.
 *
 * This is the common current-state owner for replay and key baselines. It does
 * not certify producer identity stability or an atomic filesystem snapshot.
 * Optional callbacks preserve replay's early identity refusal and existing
 * diagnostic facts without adding filesystem queries. A baseline phase can
 * supply the raw bytes it already read; replay reads through the filesystem.
 *
 * @evidence contracts/common.md#principled-implementation Exact version-one file, optional-file, entry and directory encodings preserve native byte and link semantics independently of compiler text and accessible listings. Failed capabilities and non-absence errors decline the observation.
 * @evidence contracts/common.md#clear-and-simple-design One kind-dispatched observer owns the shared encoding. Replay owns producer comparison and tracing; baseline capture owns its two independent phases.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Current bytes and metadata establish the result, never a producer's expected digest or a fixture name. Missing state is represented only after a native absence error.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes current observation from producer stability and explains the optional comparison/diagnostic boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Supplied platform and native operations preserve raw POSIX names and link text, and Windows UTF-8 name/link encoding, under the producer codec. No OS-name assumption establishes physical equality.
 * @evidence contracts/performance.md#efficient-algorithms File predicates hash observed bytes; directory predicates encode and byte-sort returned names/kinds/link text without child-content or unrelated-tree reads. Costs include returned bytes, comparisons and native metadata; callbacks consume already observed scalars.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This current observation owns no cache; callers control independent phase or generation reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Buffers and metadata are synchronous call-local values. No handle, task or historical state survives the call.
 */
export function nativeInputPredicateState(
  file: string,
  kind: Kind,
  filesystem: TtscTransformFilesystemOperations,
  callbacks: {
    readFile?: () => Buffer;
    realpath?: (value: string | null) => boolean;
    refuse?: (stage: string, error?: unknown) => void;
  } = {},
): { digest: string; realpath: string | null } | undefined {
  let currentPhysical: string | null;
  let digest: string;
  let stage = "realpath";
  const refuse = (at: string, error?: unknown): undefined => {
    callbacks.refuse?.(at, error);
    return undefined;
  };
  const hash = (bytes: string | Buffer): string =>
    createHash("sha256").update(bytes).digest("hex");
  const missing = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR");
  const platform = filesystem.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const readBytes = callbacks.readFile ?? (() => filesystem.readFile(file));
  try {
    stage = "realpath";
    try {
      currentPhysical = filesystem.realpath(file);
    } catch (error) {
      if (!missing(error)) return refuse(stage, error);
      currentPhysical = null;
    }
    if (callbacks.realpath?.(currentPhysical) === false)
      return refuse("physical-identity");
    if (kind === "file") {
      digest = hash(readBytes());
    } else if (kind === "optional-file") {
      try {
        digest = filesystem.stat(file).isFile()
          ? hash(
              Buffer.concat([Buffer.from("file\0"), readBytes()]),
            )
          : hash("missing\0");
      } catch (error) {
        if (!missing(error)) return undefined;
        digest = hash("missing\0");
      }
    } else if (kind === "entry") {
      try {
        const entry = filesystem.lstat(file);
        if (entry.isSymbolicLink()) {
          if (filesystem.readlink === undefined)
            return refuse("readlink-unavailable");
          digest = hash(
            Buffer.concat([
              Buffer.from("symlink\0"),
              filesystem.readlink(file),
            ]),
          );
        } else {
          const kind = entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : "other";
          digest = hash(kind + "\0");
        }
      } catch (error) {
        if (!missing(error)) return undefined;
        digest = hash("missing\0");
      }
    } else if (kind === "directory") {
      stage = "directory-read";
      const records: Buffer[] = [];
      if (platform === "win32") {
        for (const entry of filesystem.readdir(file)) {
          let target: Buffer = Buffer.alloc(0);
          stage = "directory-entry";
          if (entry.isSymbolicLink()) {
            stage = "directory-link";
            if (filesystem.readlink === undefined)
              return refuse("readlink-unavailable");
            target = Buffer.from(
              filesystem
                .readlink(pathApi.join(file, entry.name))
                .toString("utf8"),
              "utf8",
            );
          }
          const kind = entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : entry.isSymbolicLink()
                ? "symlink"
                : "other";
          stage = "directory-record";
          records.push(
            Buffer.concat([
              Buffer.from(entry.name),
              Buffer.from("\0" + kind + "\0"),
              target,
            ]),
          );
        }
      } else {
        if (filesystem.readdirRaw === undefined)
          return refuse("raw-directory-unavailable");
        for (const entry of filesystem.readdirRaw(file)) {
          let target: Buffer = Buffer.alloc(0);
          stage = "directory-entry";
          if (entry.isSymbolicLink()) {
            stage = "directory-link";
            if (filesystem.readlink === undefined)
              return refuse("readlink-unavailable");
            target = filesystem.readlink(
              Buffer.concat([
                Buffer.from(file),
                Buffer.from(pathApi.sep),
                entry.name,
              ]),
            );
          }
          const kind = entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : entry.isSymbolicLink()
                ? "symlink"
                : "other";
          stage = "directory-record";
          records.push(
            Buffer.concat([
              entry.name,
              Buffer.from("\0" + kind + "\0"),
              target,
            ]),
          );
        }
      }
      stage = "directory-digest";
      records.sort(Buffer.compare);
      digest = hash(
        Buffer.concat(
          records.flatMap((record, index) =>
            index === 0 ? [record] : [Buffer.from([0]), record],
          ),
        ),
      );
    } else return undefined;
    return { digest, realpath: currentPhysical };
  } catch (error) {
    return refuse(stage, error);
  }
}
