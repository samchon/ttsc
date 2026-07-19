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
 * readable here only after its current bytes hash to the snapshot's
 * `checkerDigest`. Both success and failure are cached, so every consumer of a
 * `TtscGraphMemory` sees one adjudication and one immutable line array.
 */
export class TtscGraphSourceReader {
  private readonly project: string;
  private readonly checkerDigests: ReadonlyMap<string, string>;
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
    this.checkerDigests = new Map(
      provenance?.capabilities.includes("sourceDigests") === true
        ? provenance.sources.map((source) => [
            normalize(source.file),
            source.checkerDigest,
          ])
        : [],
    );
  }

  /**
   * Return frozen lines only when the bytes still equal the checker snapshot. A
   * missing manifest entry, read failure, or digest mismatch is a cached
   * absence rather than a reason to mix current disk text into old graph
   * facts.
   */
  lines(file: string): readonly string[] | undefined {
    const key = normalize(file);
    if (this.cache.has(key)) return this.cache.get(key);

    const expected = this.checkerDigests.get(key);
    if (expected === undefined || expected === "") {
      this.cache.set(key, undefined);
      return undefined;
    }

    let text: string;
    try {
      text = this.read(path.resolve(this.project, file)).toString("utf8");
    } catch {
      this.cache.set(key, undefined);
      return undefined;
    }
    if (sha256(text) !== expected) {
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

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
