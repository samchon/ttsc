import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assert } from "../internal/ttsgraph";

interface Provenance {
  capabilities: string[];
  sources: {
    file: string;
    checkerDigest: string;
    diskDigest: string;
  }[];
}

interface SourceReader {
  lines(file: string): readonly string[] | undefined;
}

interface SourceReaderConstructor {
  new (
    project: string,
    provenance: Provenance | undefined,
    read: (file: string) => Buffer,
  ): SourceReader;
}

const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Verifies the graph source reader returns one immutable checker-identical
 * snapshot per file and caches both success and failure.
 *
 * A request-only line cache reduces repeated `readFileSync` calls but can still
 * mix graph facts with bytes written after the native snapshot. It is also
 * unsound for a source-preamble project: the disk digest can match even though
 * the checker resolved augmented text. The reader must prove the bytes it read
 * against `diskDigest`, then prove its decoded text against `checkerDigest` and
 * freeze that adjudication for the lifetime of its `TtscGraphMemory` snapshot.
 *
 * 1. Read one checker-identical file twice and assert one physical read plus an
 *    immutable, reused line array.
 * 2. Mutate a file and re-encode another after provenance capture, asserting text
 *    and raw-byte mismatches are rejected and cached.
 * 3. Model preamble, virtual, capability, and I/O failures, asserting none can be
 *    presented as checker text or retried.
 * 4. Build the minimal synthetic memory used by internal resolver tests and assert
 *    an absent provenance manifest fails closed without crashing.
 */
export const test_ttscgraph_source_reader_enforces_snapshot_identity_once =
  async () => {
    const graphRoot = path.dirname(
      createRequire(import.meta.url).resolve("@ttsc/graph/package.json"),
    );
    const module = (await import(
      pathToFileURL(
        path.join(graphRoot, "lib", "model", "TtscGraphSourceReader.js"),
      ).href
    )) as { TtscGraphSourceReader: SourceReaderConstructor };
    const Reader = module.TtscGraphSourceReader;

    const stable = "export const stable = 1;\n";
    let stableReads = 0;
    const stableReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/stable.ts",
            checkerDigest: digest(stable),
            diskDigest: digest(Buffer.from(stable, "utf8")),
          },
        ],
      },
      () => {
        stableReads++;
        return Buffer.from(stable, "utf8");
      },
    );
    const first = stableReader.lines("src/stable.ts");
    const second = stableReader.lines("src/stable.ts");
    assert.deepEqual(first, ["export const stable = 1;", ""]);
    assert.strictEqual(second, first, "the immutable snapshot array is reused");
    assert.equal(stableReads, 1, "a successful file is read once per snapshot");
    assert.ok(Object.isFrozen(first), "cached source lines are immutable");

    const before = "export const before = 1;\n";
    let current = "export const after = 2;\n";
    let mutationReads = 0;
    const mutatedReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/mutated.ts",
            checkerDigest: digest(before),
            diskDigest: digest(Buffer.from(before, "utf8")),
          },
        ],
      },
      () => {
        mutationReads++;
        return Buffer.from(current, "utf8");
      },
    );
    assert.equal(
      mutatedReader.lines("src/mutated.ts"),
      undefined,
      "post-snapshot bytes cannot be mixed with the older graph",
    );
    current = before;
    assert.equal(
      mutatedReader.lines("src/mutated.ts"),
      undefined,
      "a failed snapshot adjudication is stable, not timing-dependent",
    );
    assert.equal(mutationReads, 1, "digest mismatches are cached as failures");

    const reencoded = "export const reencoded = true;\n";
    let reencodedReads = 0;
    const reencodedReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/reencoded.ts",
            checkerDigest: digest(reencoded),
            diskDigest: digest(Buffer.from(reencoded, "utf8")),
          },
        ],
      },
      () => {
        reencodedReads++;
        return Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          Buffer.from(reencoded, "utf8"),
        ]);
      },
    );
    assert.equal(
      reencodedReader.lines("src/reencoded.ts"),
      undefined,
      "same decoded text with different raw bytes is not this snapshot",
    );
    assert.equal(reencodedReads, 1, "raw-byte mismatches are not retried");

    const disk = "export const disk = true;\n";
    const checker = "declare const injected: number;\n" + disk;
    let preambleReads = 0;
    const preambleReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/preamble.ts",
            checkerDigest: digest(checker),
            diskDigest: digest(Buffer.from(disk, "utf8")),
          },
        ],
      },
      () => {
        preambleReads++;
        return Buffer.from(disk, "utf8");
      },
    );
    assert.equal(
      preambleReader.lines("src/preamble.ts"),
      undefined,
      "disk-identical preamble sources are not checker-identical sources",
    );
    assert.equal(preambleReads, 1);

    let missingCapabilityReads = 0;
    const missingCapabilityReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests"],
        sources: [
          {
            file: "src/missing.ts",
            checkerDigest: digest("missing"),
            diskDigest: "",
          },
        ],
      },
      () => {
        missingCapabilityReads++;
        return Buffer.from("missing", "utf8");
      },
    );
    assert.equal(
      missingCapabilityReader.lines("src/missing.ts"),
      undefined,
      "a snapshot without disk digests stays conservative",
    );
    assert.equal(
      missingCapabilityReads,
      0,
      "a missing disk-digest capability fails closed before disk I/O",
    );

    let virtualReads = 0;
    const virtualReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "bundled:///lib.d.ts",
            checkerDigest: digest("declare const bundled: true;\n"),
            diskDigest: "",
          },
        ],
      },
      () => {
        virtualReads++;
        return Buffer.from("declare const bundled: true;\n", "utf8");
      },
    );
    assert.equal(
      virtualReader.lines("bundled:///lib.d.ts"),
      undefined,
      "virtual sources without a disk digest remain unverifiable",
    );
    assert.equal(
      virtualReads,
      0,
      "an empty disk digest fails closed before disk I/O",
    );

    let failureReads = 0;
    const failureReader = new Reader(
      "C:/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/missing.ts",
            checkerDigest: digest("missing"),
            diskDigest: digest(Buffer.from("missing", "utf8")),
          },
        ],
      },
      () => {
        failureReads++;
        throw new Error("missing");
      },
    );
    assert.equal(failureReader.lines("src/missing.ts"), undefined);
    assert.equal(failureReader.lines("src/missing.ts"), undefined);
    assert.equal(failureReads, 1, "I/O failures are cached per snapshot");

    let absentReads = 0;
    const absentReader = new Reader("C:/project", undefined, () => {
      absentReads++;
      return Buffer.from(stable, "utf8");
    });
    assert.equal(absentReader.lines("src/stable.ts"), undefined);
    assert.equal(
      absentReads,
      0,
      "synthetic graph memories without provenance fail closed before disk I/O",
    );

    const memoryModule = (await import(
      pathToFileURL(path.join(graphRoot, "lib", "model", "TtscGraphMemory.js"))
        .href
    )) as {
      TtscGraphMemory: {
        from(dump: unknown): { source: SourceReader };
      };
    };
    const synthetic = memoryModule.TtscGraphMemory.from({
      project: "C:/project",
      nodes: [],
      edges: [],
    });
    assert.equal(
      synthetic.source.lines("src/stable.ts"),
      undefined,
      "a no-manifest synthetic memory remains usable and source-free",
    );
  };
