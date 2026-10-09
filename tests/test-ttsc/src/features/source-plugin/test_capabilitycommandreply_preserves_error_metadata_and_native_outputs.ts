import assert from "node:assert/strict";
import { serialize } from "node:v8";

import { restoreCompilerError } from "../../../../../packages/ttsc/src/internal/restoreCompilerError";
import { serializeCompilerError } from "../../../../../packages/ttsc/src/internal/serializeCompilerError";
import { decodeCapabilityCommandReply } from "../../../../../packages/ttsc/src/plugin/internal/decodeCapabilityCommandReply";

/**
 * Verifies native output decoding preserves Buffer-shaped error metadata.
 *
 * Actual Buffers and ordinary data with Buffer-shaped fields have distinct
 * structured representations. Sparse array metadata also survives this wire.
 *
 * 1. Encode real Buffer outputs alongside authored marker and array metadata.
 * 2. Decode the actual command reply and verify exact binary and text outputs.
 * 3. Restore both error branches without changing their metadata objects.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual compiler serializer, Node wire encoder, command reply decoder and error restorer, asserting exact stdout/output bytes, text/null fields, Buffer-shaped metadata and sparse array fields in result.error and thrown; invalid bytes must throw.
 * @evidence contracts/testing.md#independent-expectations Native Buffers contain authored bytes while ordinary enumerable metadata owns its literal fields and sparse array owns only its authored indices/properties. Those original relationships and values define independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Real binary fields contrast with text/null outputs and identical Buffer-shaped metadata in both error branches. Sparse holes/custom fields distinguish lossless transport from JSON, while missing result, unknown retirement and invalid encoded bytes distinguish absent evidence from fabricated success.
 * @evidence contracts/testing.md#execution-ownership One discoverable same-process unit invokes maintained transport operations on authored values; it starts no worker, native command, compiler or installed consumer and replaces no foreign method.
 */
export function test_capabilitycommandreply_preserves_error_metadata_and_native_outputs(): void {
  const metadata = { type: "Buffer", data: [65, 66] };
  const values = new Array(4) as unknown[] & { detail?: string };
  values[0] = "kept";
  values.detail = "enumerable array metadata";
  const source = Object.assign(new Error("native refusal"), {
    metadata,
    values,
  });
  const bytes = Buffer.from([0, 65, 255]);
  const reply = decodeCapabilityCommandReply(
    serialize({
      retirement: "joined",
      result: {
        stdout: bytes,
        stderr: "text output",
        output: [null, bytes, "text output"],
        error: serializeCompilerError(source),
      },
      thrown: serializeCompilerError(source),
    }),
  );
  assert.equal(reply.retirement, "joined");
  assert.ok(Buffer.isBuffer(reply.result!.stdout));
  assert.deepEqual(reply.result!.stdout, Buffer.from([0, 65, 255]));
  assert.equal(reply.result!.stderr, "text output");
  assert.deepEqual(reply.result!.output, [
    null,
    Buffer.from([0, 65, 255]),
    "text output",
  ]);
  for (const value of [reply.result!.error, reply.thrown]) {
    const received = restoreCompilerError(value) as Error & {
      metadata: unknown;
      values: typeof values;
    };
    assert.equal(received.message, "native refusal");
    assert.deepEqual(received.metadata, { type: "Buffer", data: [65, 66] });
    assert.equal(Buffer.isBuffer(received.metadata), false);
    assert.equal(received.values.length, 4);
    assert.equal(received.values[0], "kept");
    assert.equal(received.values.detail, "enumerable array metadata");
    assert.deepEqual(Object.keys(received.values), ["0", "detail"]);
  }
  const absent = decodeCapabilityCommandReply(
    serialize({ retirement: "unknown", thrown: { message: "unproved" } }),
  );
  assert.equal(absent.retirement, "unknown");
  assert.equal(absent.result, undefined);
  assert.deepEqual(absent.thrown, { message: "unproved" });
  assert.throws(() => decodeCapabilityCommandReply(Buffer.from([0, 1, 2])));
}
