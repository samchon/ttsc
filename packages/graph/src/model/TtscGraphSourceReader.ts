import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { type ITtscGraphDump } from "../structures/ITtscGraphDump";

type ReadFile = (file: string) => Buffer;

/**
 * Immutable, provenance-gated source lines owned by one graph snapshot.
 *
 * Signatures and declaration docs are display facts derived from source text,
 * but the live disk is not the snapshot the checker resolved. A file becomes
 * readable here only after its current bytes hash to `diskDigest` and the
 * compiler-decoded text hashes to `checkerDigest`. Both success and failure are
 * cached, so every consumer of a `TtscGraphMemory` sees one adjudication and
 * one immutable line array.
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
   * equal the checker snapshot. A missing manifest entry, read failure, or
   * digest mismatch is a cached absence rather than a reason to mix current
   * disk text into old graph facts.
   */
  lines(file: string): readonly string[] | undefined {
    const key = normalize(file);
    if (this.cache.has(key)) return this.cache.get(key);

    const expected = this.digests.get(key);
    if (
      expected === undefined ||
      expected.checker === "" ||
      expected.disk === ""
    ) {
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

    const lines: readonly string[] = Object.freeze(text.split(/\r?\n/));
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
