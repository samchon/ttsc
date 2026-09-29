import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { type ITtscGraphDump } from "../structures/ITtscGraphDump";

type ReadFile = (file: string) => Buffer;

/**
 * Immutable, provenance-gated source lines owned by one graph snapshot.
 *
 * Declaration documentation is a display fact derived from source text,
 * but the live disk is not the snapshot the checker resolved. A file becomes
 * readable here only after its current bytes hash to `diskDigest` and the
 * compiler-decoded text hashes to `checkerDigest`. Manifest members cache both
 * success and failure, so every consumer of a `TtscGraphMemory` sees one
 * adjudication and one immutable line array. Unknown names remain uncached;
 * they have no snapshot witness to adjudicate.
 *
 * @evidence contracts/common.md#principled-implementation Raw-byte and decoded-text SHA-256 must both match producer witnesses before live disk text can become a snapshot display fact.
 * @evidence contracts/common.md#clear-and-simple-design One snapshot reader owns provenance selection, decoding and per-file adjudication rather than letting consumers read disk independently.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing provenance or digest mismatch yields absence instead of mixing current source into old checker facts.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the dual witnesses, immutable lines and cached failure behavior.
 * @evidenceExclude contracts/performance.md#efficient-algorithms lines owns hashing, decoding and splitting strategy through its private helpers.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work lines coordinates per-generation success/absence reuse; the declaration exposes that owner.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lines controls retained per-file entries and the graph owns reader lifetime; the declaration adds no separate acquisition or release.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The type exposes a source-reading contract; lines and its helpers perform the native filesystem boundary.
 */
export class TtscGraphSourceReader {
  private readonly project: string;
  private readonly digests: ReadonlyMap<
    string,
    { checker: string; disk: string }
  >;
  private readonly read: ReadFile;
  private readonly cache = new Map<string, readonly string[] | undefined>();

  constructor(
    project: string,
    provenance:
      | Pick<ITtscGraphDump.IProvenance, "capabilities" | "sources">
      | undefined,
    read: ReadFile = (file) => fs.readFileSync(file),
  ) {
    this.project = project;
    this.read = read;
    this.digests = new Map(
      provenance?.capabilities.includes("sourceDigests") === true &&
        provenance.capabilities.includes("diskDigests") === true
        ? provenance.sources.map((source) => [
            normalize(source.file),
            { checker: source.checkerDigest, disk: source.diskDigest },
          ])
        : [],
    );
  }

  /**
   * Return frozen lines only when raw disk bytes and compiler-decoded text both
   * equal the checker snapshot. Missing manifest entries return absence without
   * storage or disk access. For manifest members, missing digests, read failure
   * and digest mismatch are cached absences rather than reasons to mix current
   * disk text into old graph facts.
   *
   * @evidence contracts/common.md#principled-implementation Normalized file lookup, raw hash, BOM-aware decoding and checker-text hash establish both byte and semantic snapshot identity before freezing lines.
   * @evidence contracts/common.md#clear-and-simple-design One path adjudicates all source display reads, with decoding/hash helpers isolated from cache ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witnesses return absence without disk access; changed bytes remain a cached absence rather than a fallback to unverified live text.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes uncached unknown names from cached adjudications of manifest members.
   * @evidence contracts/portability.md#os-neutral-implementation Dump separators are normalized only for manifest lookup; Node path.resolve and fs read the project-native location without inferring case policy from OS.
   * @evidence contracts/performance.md#efficient-algorithms A first read costs linear file bytes for hashes, BOM decoding and line splitting; later lookups use the per-file map.
   * @evidence contracts/performance.md#reuse-equivalent-work Manifest-member success and absence are cached by normalized path within one immutable provenance generation; unknown names need only a map lookup and a new graph creates a new reader.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only manifest members can enter the adjudication cache, bounding retained entries and line arrays by the snapshot source population; releasing the owning graph releases both maps.
   */
  lines(file: string): readonly string[] | undefined {
    const key = normalize(file);
    if (this.cache.has(key)) return this.cache.get(key);

    const expected = this.digests.get(key);
    if (expected === undefined) return undefined;
    if (expected.checker === "" || expected.disk === "") {
      this.cache.set(key, undefined);
      return undefined;
    }

    let bytes: Buffer;
    try {
      bytes = this.read(path.resolve(this.project, file));
    } catch {
      this.cache.set(key, undefined);
      return undefined;
    }
    if (sha256(bytes) !== expected.disk) {
      this.cache.set(key, undefined);
      return undefined;
    }

    const text = decodeSource(bytes);
    if (sha256(text) !== expected.checker) {
      this.cache.set(key, undefined);
      return undefined;
    }

    const lines: readonly string[] = Object.freeze(
      text.split(/\r\n|[\n\r\u2028\u2029]/u),
    );
    this.cache.set(key, lines);
    return lines;
  }
}

function normalize(file: string): string {
  return file.replace(/\\/g, "/");
}

function decodeSource(bytes: Buffer): string {
  if (bytes.length >= 2) {
    const body = bytes.subarray(2, bytes.length - ((bytes.length - 2) % 2));
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return body.toString("utf16le");
    if (bytes[0] === 0xfe && bytes[1] === 0xff)
      return Buffer.from(body).swap16().toString("utf16le");
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  )
    return bytes.subarray(3).toString("utf8");
  return bytes.toString("utf8");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
