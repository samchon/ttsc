import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "ts-legacy";
import { parse } from "yaml";

/**
 * Verifies local Swagger reads bound acquired bytes and attempt handle release.
 *
 * An owned VM evaluates the current loader source with a private file adapter.
 * Its stat can deliberately precede file growth, a deterministic interleaving
 * that an ordinary static large-file fixture cannot expose. Parsing and OpenAPI
 * conversion are the actual package dependencies; no global API is replaced.
 *
 * 1. Accept valid documents just below and exactly at the 16MiB limit and
 *    compare their digest with an independent raw-byte SHA-256.
 * 2. Grow the advertised small file beyond the limit and require rejection
 *    after at most one sentinel byte, with bounded individual reads.
 * 3. Accumulate short reads in the same bounded buffer, reject an initially
 *    oversized file before reading, and preserve unreadable UTF-8 and I/O
 *    failures while awaiting close on every acquired-handle path.
 * 4. Collect independent rows and propagate close rejection after success, stat,
 *    not-file and read failures without claiming successful resource release.
 *
 * @evidence contracts/testing.md#behavioral-verification The current loader executes local-source admission through a VM-local file adapter whose handle reads expose deterministic post-stat growth. Real YAML parsing and OpenAPI conversion accept exact valid bytes, while over-limit, invalid UTF-8 and read-error cases retain problems. Successful-close counters cover their authored paths; four private close-rejection controls distinguish an awaited attempt from release success and preserve the resulting source problem.
 * @evidence contracts/testing.md#independent-expectations Literal 16MiB minus-one/exact/plus-one populations establish admission independently of implementation constants. Node SHA-256 of authored accepted bytes establishes cache identity, and adapter counters expose maximum acquired bytes, close attempts and successful-close outcomes without deriving expectations from loader output.
 * @evidence contracts/testing.md#distinguishing-cases A small stat followed by large actual bytes distinguishes a genuine read bound from stat-only admission. Exact-limit EOF, three-byte short reads accumulated into one buffer, initial oversize, invalid UTF-8, failed I/O and close rejection retain distinct outcomes. Each independent row is collected before this entry fails.
 * @evidence contracts/testing.md#execution-ownership This named source unit transpiles the authored loader into an owned VM and calls its exported API with private module inputs. It builds no package or native artifact, starts no product host and mutates no foreign filesystem method.
 */
export async function test_swagger_source_loader_bounds_actual_local_reads(): Promise<void> {
  const limit = 16 * 1024 * 1024;
  const errors: Error[] = [];
  const check = async (name: string, run: () => Promise<void>) => {
    try { await run(); } catch (cause) { errors.push(new Error(name, { cause })); }
  };
  const document = Buffer.from(JSON.stringify({ openapi: "3.1.0", info: { title: "bound", version: "1" }, paths: {} }));
  for (const length of [limit - 1, limit]) {
    await check(`accepted-${length}`, async () => {
      const bytes = Buffer.concat([document, Buffer.alloc(length - document.length, 32)]);
      const probe = loader(bytes, 1);
      const result = await probe.load({ root: "/virtual", sources: ["doc.json"] });
      assert.equal(result.documents.length, 1, JSON.stringify(result));
      assert.equal(result.problems.length, 0);
      assert.equal(result.documents[0]!.digest, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(probe.readBytes(), length);
      assert.equal(probe.closed(), 1);
      assert.ok(probe.largestRead() <= 64 * 1024);
    });
  }
  const oversized = Buffer.concat([document, Buffer.alloc(limit + 1 - document.length, 32)]);
  await check("short-read-buffer-retention", async () => {
    const shortReads = loader(document, 1, false, 3);
    const shortResult = await shortReads.load({ root: "/virtual", sources: ["doc.json"] });
    assert.equal(shortResult.documents.length, 1);
    assert.equal(shortResult.documents[0]!.digest, createHash("sha256").update(document).digest("hex"));
    assert.equal(shortReads.readBytes(), document.length);
    assert.equal(shortReads.closed(), 1);
    assert.deepEqual(shortReads.readOffsets().slice(0, 3), [0, 3, 6]);
  });
  await check("post-stat-growth", async () => {
    const growing = loader(oversized, 1);
    const rejected = await growing.load({ root: "/virtual", sources: ["doc.json"] });
    assert.equal(rejected.documents.length, 0);
    assert.match(rejected.problems[0]!.message, /exceeds the 16777216 byte limit/);
    assert.equal(rejected.problems[0]!.digest, "");
    assert.equal(growing.readBytes(), limit + 1);
    assert.equal(growing.closed(), 1);
    assert.ok(growing.largestRead() <= 64 * 1024);
  });
  await check("initial-oversize", async () => {
    const alreadyLarge = loader(oversized, limit + 1);
    assert.equal((await alreadyLarge.load({ root: "/virtual", sources: ["doc.json"] })).documents.length, 0);
    assert.equal(alreadyLarge.readBytes(), 0);
    assert.equal(alreadyLarge.closed(), 1);
  });
  await check("invalid-utf8", async () => {
    const invalidUtf8 = loader(Buffer.from([0xff]), 1);
    const unreadable = await invalidUtf8.load({ root: "/virtual", sources: ["doc.json"] });
    assert.equal(unreadable.documents.length, 0);
    assert.match(unreadable.problems[0]!.message, /valid for encoding utf-8/);
    assert.equal(unreadable.problems[0]!.digest, "");
    assert.equal(invalidUtf8.closed(), 1);
  });
  await check("read-failure", async () => {
    const failedRead = loader(document, 1, true);
    const failed = await failedRead.load({ root: "/virtual", sources: ["doc.json"] });
    assert.match(failed.problems[0]!.message, /authored read failure/);
    assert.equal(failedRead.closed(), 1);
  });
  for (const [name, options, failRead] of [
    ["close-after-success", {}, false],
    ["close-after-stat-failure", { failStat: true }, false],
    ["close-after-not-file", { isFile: false }, false],
    ["close-after-read-failure", {}, true],
  ] as const) {
    await check(name, async () => {
      const probe = loader(document, document.length, failRead, Infinity, { ...options, failClose: true });
      const result = await probe.load({ root: "/virtual", sources: ["doc.json"] });
      assert.equal(result.documents.length, 0);
      assert.equal(result.problems.length, 1);
      assert.match(result.problems[0]!.message, /authored close failure/);
      assert.equal(result.problems[0]!.digest, "");
      assert.equal(probe.closeAttempts(), 1);
      assert.equal(probe.closed(), 0);
    });
  }
  if (errors.length) throw new AggregateError(errors, "Swagger local-read boundary matrix");
}

function loader(bytes: Buffer, advertisedSize: number, failRead = false, maximumRead = Infinity, options: { failStat?: boolean; isFile?: boolean; failClose?: boolean } = {}) {
  const sourceRequire = createRequire(import.meta.url);
  const { canonicalDigest } = sourceRequire(fileURLToPath(new URL("../../../../packages/evidence/src/internal/canonicalDigest.ts", import.meta.url)));
  const { normalizeSwaggerDocument } = sourceRequire(fileURLToPath(new URL("../../../../packages/evidence/src/internal/normalizeSwaggerDocument.ts", import.meta.url)));
  let position = 0;
  let acquired = 0;
  let closed = 0;
  let closeAttempts = 0;
  let largest = 0;
  const offsets: number[] = [];
  const stat = async () => {
    if (options.failStat) throw new Error("authored stat failure");
    return { isFile: () => options.isFile !== false, size: advertisedSize };
  };
  const adapter = {
    stat,
    readFile: async () => bytes,
    open: async () => ({
      stat,
      read: async (target: Buffer, offset: number, length: number) => {
        if (failRead) throw new Error("authored read failure");
        largest = Math.max(largest, length);
        offsets.push(offset);
        const count = Math.min(length, maximumRead, bytes.length - position);
        bytes.copy(target, offset, position, position + count);
        position += count;
        acquired += count;
        return { bytesRead: count, buffer: target };
      },
      close: async () => {
        ++closeAttempts;
        if (options.failClose) throw new Error("authored close failure");
        ++closed;
      },
    }),
  };
  const source = fs.readFileSync(new URL("../../../../packages/evidence/src/internal/loadSwaggerOperations.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({
    exports: {}, Buffer, TextDecoder, URL,
    require: (name: string) => {
      switch (name) {
        case "node:crypto": return { createHash };
        case "node:fs/promises": return adapter;
        case "node:path": return path;
        case "yaml": return { parse };
        case "./canonicalDigest": return { canonicalDigest };
        case "./normalizeSwaggerDocument": return { normalizeSwaggerDocument };
        default: throw new Error(`unexpected loader import ${name}`);
      }
    },
  });
  vm.runInContext(compiled, context);
  type Result = { documents: Array<{ digest: string }>; problems: Array<{ message: string; digest: string }> };
  const load = (context.exports as { loadSwaggerOperations: (request: { root: string; sources: string[] }) => Promise<Result> }).loadSwaggerOperations;
  return { load, readBytes: () => acquired, closed: () => closed, largestRead: () => largest, readOffsets: () => offsets, closeAttempts: () => closeAttempts };
}
