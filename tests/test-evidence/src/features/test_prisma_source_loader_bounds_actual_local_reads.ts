import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "ts-legacy";

/**
 * Verifies Prisma local reads bound acquired bytes and attempt handle release.
 *
 * An owned VM executes the authored loader with a private file adapter. The
 * actual resolved Prisma WASM parses accepted bytes in this same process;
 * stat/read interleavings and failures belong only to the adapter, not foreign
 * APIs. Each matrix row retains its failure identity and runs independently.
 *
 * 1. Accept literal 16MiB minus-one/exact schemas and three-byte short reads,
 *    preserving real model identities and independently framed raw-byte
 *    hashes.
 * 2. Reject initial oversize and post-stat growth/replacement with at most one
 *    sentinel byte, bounded chunks and the same buffer across short reads.
 * 3. Distinguish not-file, invalid UTF-8, open/stat/read failures and readable
 *    parser rejection; collect independent sets and whole-set read failures.
 * 4. Propagate close rejection after success, stat, not-file and read errors,
 *    distinguishing an awaited close attempt from successful release.
 *
 * @evidence contracts/testing.md#behavioral-verification The current loadPrismaModels source executes through a VM-local file adapter and real resolved WASM. Exact valid schemas materialize literal model/column identities; post-stat oversize is rejected without acquiring the full file, and acquired-handle paths await close. Four private close-rejection controls retain attributed problems; successful release is not inferred from a rejected close.
 * @evidence contracts/testing.md#independent-expectations Literal 16777215/16777216/16777217 byte populations and Node raw-byte SHA-256 framed with the authored source path, NUL and newline establish the per-file admission and cache identity. Adapter counters and Buffer identity expose acquisition and short-read retention without using loader output as their oracle.
 * @evidence contracts/testing.md#distinguishing-cases Growth and replacement after a small stat differ from initial oversize. Empty input, short reads, non-files, invalid UTF-8, open/stat/read/close errors, parser-invalid readable bytes and a later unreadable member preserve distinct outcomes and independent-set collection. This asserts neither a per-set limit nor a whole-process memory quota.
 * @evidence contracts/testing.md#execution-ownership The named test-evidence feature export evaluates maintained loader source in an owned VM and invokes its real exported API. Its module resolver selects the actual WASM dependency; it installs nothing, builds no native artifact, starts no product host and mutates no foreign API.
 */
export async function test_prisma_source_loader_bounds_actual_local_reads(): Promise<void> {
  const limit = 16 * 1024 * 1024;
  const errors: Error[] = [];
  const check = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (cause) {
      errors.push(new Error(name, { cause }));
    }
  };
  for (const length of [limit - 1, limit]) {
    await check(`accepted-${length}`, async () => {
      const bytes = schema(length);
      const probe = loader({ "schema.prisma": { bytes, size: length } });
      const result = await probe.load([
        { id: "schema", files: ["schema.prisma"] },
      ]);
      assertAccepted(
        result,
        "schema",
        ["Bound"],
        framed([["schema.prisma", bytes]]),
      );
      assert.equal(probe.acquired(), length);
      assert.equal(probe.closed(), 1);
      assert.ok(probe.largest() <= 64 * 1024);
    });
  }
  for (const [name, length, size] of [
    ["initial-oversize", limit + 1, limit + 1],
    ["post-stat-growth", limit + 1, 64],
    ["post-stat-replacement", limit + 4096, 64],
  ] as const) {
    await check(name, async () => {
      const probe = loader({
        "schema.prisma": { bytes: schema(length, "Replaced"), size },
      });
      const result = await probe.load([
        { id: "schema", files: ["schema.prisma"] },
      ]);
      assertUnreadable(result, /exceeds the 16777216 byte limit/);
      assert.equal(probe.acquired(), size > limit ? 0 : limit + 1);
      assert.equal(probe.closed(), 1);
      assert.ok(probe.largest() <= 64 * 1024);
    });
  }
  await check("short-read-buffer-retention", async () => {
    const bytes = schema(128);
    const probe = loader({
      "schema.prisma": { bytes, size: bytes.length, maximumRead: 3 },
    });
    assertAccepted(
      await probe.load([{ id: "schema", files: ["schema.prisma"] }]),
      "schema",
      ["Bound"],
      framed([["schema.prisma", bytes]]),
    );
    assert.equal(probe.acquired(), bytes.length);
    assert.equal(probe.closed(), 1);
    assert.deepEqual(probe.offsets().slice(0, 3), [0, 3, 6]);
    assert.strictEqual(probe.buffers()[0], probe.buffers()[1]);
    assert.strictEqual(probe.buffers()[1], probe.buffers()[2]);
  });
  const failures: Array<[string, FileInput, RegExp, number]> = [
    [
      "not-file",
      { bytes: schema(64), size: 64, isFile: false },
      /not a file/,
      1,
    ],
    [
      "invalid-utf8",
      { bytes: Buffer.from([0xff]), size: 1 },
      /valid for encoding utf-8/,
      1,
    ],
    [
      "open-failure",
      { bytes: schema(64), size: 64, failOpen: true },
      /authored open failure/,
      0,
    ],
    [
      "stat-failure",
      { bytes: schema(64), size: 64, failStat: true },
      /authored stat failure/,
      1,
    ],
    [
      "read-failure",
      { bytes: schema(64), size: 64, failRead: true },
      /authored read failure/,
      1,
    ],
  ];
  for (const [name, input, reason, expectedClosed] of failures) {
    await check(name, async () => {
      const probe = loader({ "schema.prisma": input });
      assertUnreadable(
        await probe.load([{ id: "schema", files: ["schema.prisma"] }]),
        reason,
      );
      assert.equal(probe.closed(), expectedClosed);
      if (
        input.isFile === false ||
        input.failOpen ||
        input.failStat ||
        input.failRead
      )
        assert.equal(probe.acquired(), 0);
    });
  }
  await check("readable-parser-invalid", async () => {
    const bytes = Buffer.from("model Broken {\n id UnknownType @id\n}\n");
    const probe = loader({ "schema.prisma": { bytes, size: bytes.length } });
    const result = await probe.load([
      { id: "schema", files: ["schema.prisma"] },
    ]);
    assert.equal(result.documents.length, 0);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0]!.message, /UnknownType/);
    assert.equal(
      result.problems[0]!.digest,
      framed([["schema.prisma", bytes]]),
    );
    assert.equal(probe.closed(), 1);
  });
  await check("empty-readable-schema", async () => {
    const bytes = Buffer.alloc(0);
    const probe = loader({ "empty.prisma": { bytes, size: 0 } });
    assertAccepted(
      await probe.load([{ id: "empty", files: ["empty.prisma"] }]),
      "empty",
      [],
      framed([["empty.prisma", bytes]]),
    );
    assert.equal(probe.acquired(), 0);
    assert.equal(probe.closed(), 1);
  });
  await check("two-file-later-growth-and-independent-set", async () => {
    const first = schema(64, "First");
    const probe = loader({
      "first.prisma": { bytes: first, size: first.length },
      "second.prisma": { bytes: schema(limit + 1, "Second"), size: 64 },
      "good.prisma": { bytes: schema(64, "Good"), size: 64 },
    });
    const result = await probe.load([
      { id: "broken", files: ["first.prisma", "second.prisma"] },
      { id: "good", files: ["good.prisma"] },
    ]);
    assert.equal(result.documents.length, 1);
    assert.equal(result.problems.length, 1);
    assert.equal(result.documents[0]!.id, "good");
    assert.equal(result.documents[0]!.models[0]!.name, "Good");
    assert.equal(
      result.documents[0]!.digest,
      framed([["good.prisma", schema(64, "Good")]]),
    );
    assert.equal(result.problems[0]!.id, "broken");
    assert.equal(result.problems[0]!.digest, "");
    assert.match(
      result.problems[0]!.message,
      /exceeds the 16777216 byte limit/,
    );
    assert.equal(probe.acquired(), first.length + limit + 1 + 64);
    assert.equal(probe.closed(), 3);
  });
  for (const [name, input] of [
    ["close-after-success", {}],
    ["close-after-stat-failure", { failStat: true }],
    ["close-after-not-file", { isFile: false }],
    ["close-after-read-failure", { failRead: true }],
  ] as const) {
    await check(name, async () => {
      const probe = loader({
        "schema.prisma": {
          bytes: schema(64),
          size: 64,
          ...input,
          failClose: true,
        },
      });
      assertUnreadable(
        await probe.load([{ id: "schema", files: ["schema.prisma"] }]),
        /authored close failure/,
      );
      assert.equal(probe.closeAttempts(), 1);
      assert.equal(probe.closed(), 0);
    });
  }
  if (errors.length)
    throw new AggregateError(errors, "Prisma local-read boundary matrix");
}

interface FileInput {
  bytes: Buffer;
  size: number;
  maximumRead?: number;
  isFile?: boolean;
  failOpen?: boolean;
  failStat?: boolean;
  failRead?: boolean;
  failClose?: boolean;
}
interface Result {
  documents: Array<{
    id: string;
    digest: string;
    models: Array<{
      name: string;
      fields: Array<{ name: string; symbol: string }>;
    }>;
  }>;
  problems: Array<{ id: string; digest: string; message: string }>;
}
function schema(length: number, name = "Bound"): Buffer {
  const declaration = Buffer.from(`model ${name} {\n id String @id\n}\n`);
  return Buffer.concat([
    declaration,
    Buffer.alloc(length - declaration.length, 32),
  ]);
}
function framed(files: Array<[string, Buffer]>): string {
  const content = files
    .map(
      ([source, bytes]) =>
        `${source}\u0000${createHash("sha256").update(bytes).digest("hex")}\n`,
    )
    .join("");
  return createHash("sha256").update(content).digest("hex");
}
function assertAccepted(
  result: Result,
  id: string,
  names: string[],
  digest: string,
): void {
  assert.equal(result.documents.length, 1, JSON.stringify(result));
  assert.equal(result.problems.length, 0);
  const document = result.documents[0]!;
  assert.equal(document.id, id);
  assert.equal(document.digest, digest);
  assert.deepEqual(
    Array.from(document.models, (model) => model.name),
    names,
  );
  for (const model of document.models) {
    assert.equal(model.fields.length, 1);
    assert.equal(model.fields[0]!.name, "id");
    assert.equal(model.fields[0]!.symbol, "column");
  }
}
function assertUnreadable(result: Result, reason: RegExp): void {
  assert.equal(result.documents.length, 0);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0]!.message, reason);
  assert.equal(result.problems[0]!.digest, "");
}
function loader(files: Record<string, FileInput>) {
  const sourceRequire = createRequire(import.meta.url);
  const sourceFile = fileURLToPath(
    new URL(
      "../../../../packages/evidence/src/internal/loadPrismaModels.ts",
      import.meta.url,
    ),
  );
  const root = path.resolve(path.dirname(sourceFile), "../..");
  const canonical = sourceRequire(
    fileURLToPath(
      new URL(
        "../../../../packages/evidence/src/internal/canonicalDigest.ts",
        import.meta.url,
      ),
    ),
  );
  let acquired = 0,
    closed = 0,
    largest = 0,
    closeAttempts = 0;
  const offsets: number[] = [];
  const buffers: Buffer[] = [];
  const locate = (location: string): FileInput => {
    const input = files[path.basename(location)];
    if (!input) throw new Error(`unknown authored schema ${location}`);
    return input;
  };
  const stat = async (input: FileInput) => {
    if (input.failStat) throw new Error("authored stat failure");
    return { size: input.size, isFile: () => input.isFile !== false };
  };
  const adapter = {
    stat: async (location: string) => stat(locate(location)),
    readFile: async (location: string) => {
      const input = locate(location);
      if (input.failRead) throw new Error("authored read failure");
      acquired += input.bytes.length;
      return input.bytes;
    },
    open: async (location: string) => {
      const input = locate(location);
      if (input.failOpen) throw new Error("authored open failure");
      let position = 0;
      return {
        stat: () => stat(input),
        read: async (target: Buffer, offset: number, length: number) => {
          if (input.failRead) throw new Error("authored read failure");
          largest = Math.max(largest, length);
          offsets.push(offset);
          buffers.push(target);
          const count = Math.min(
            length,
            input.maximumRead ?? Infinity,
            input.bytes.length - position,
          );
          input.bytes.copy(target, offset, position, position + count);
          position += count;
          acquired += count;
          return { bytesRead: count, buffer: target };
        },
        close: async () => {
          ++closeAttempts;
          if (input.failClose) throw new Error("authored close failure");
          ++closed;
        },
      };
    },
  };
  const source = fs.readFileSync(sourceFile, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = vm.createContext({
    exports: {},
    Buffer,
    TextDecoder,
    __filename: sourceFile,
    require: (name: string) => {
      if (name === "node:fs/promises") return adapter;
      if (name === "./canonicalDigest") return canonical;
      return sourceRequire(name);
    },
  });
  vm.runInContext(compiled, context);
  const operation = (
    context.exports as {
      loadPrismaModels: (request: {
        root: string;
        sets: Array<{ id: string; files: string[] }>;
      }) => Promise<Result>;
    }
  ).loadPrismaModels;
  return {
    load: (sets: Array<{ id: string; files: string[] }>) =>
      operation({ root, sets }),
    acquired: () => acquired,
    closed: () => closed,
    largest: () => largest,
    offsets: () => offsets,
    buffers: () => buffers,
    closeAttempts: () => closeAttempts,
  };
}
