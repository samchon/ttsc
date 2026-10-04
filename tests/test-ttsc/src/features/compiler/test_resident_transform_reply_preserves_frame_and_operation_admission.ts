import assert from "node:assert/strict";

import { ResidentTransformReply } from "../../../../../packages/ttsc/src/compiler/internal/ResidentTransformReply";

/**
 * Exercise the parser and operation admission used by the actual resident reader.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual production-used ResidentTransformReply.parse rejects six authored malformed/nonobject frames and preserves legal object fields; isValid accepts legal transform/update negatives and positives while refusing the original three wrong-operation shapes.
 * @evidence contracts/testing.md#independent-expectations The protocol requires a JSON object, boolean found for transform with string typescript only when found is true, and boolean updated for update. Literal raw frames and independent boolean expectations distinguish these rules without copying the implementation's computation.
 * @evidence contracts/testing.md#distinguishing-cases not-json, array, number, string, boolean and null contrast with legal objects. Empty objects, boolean-looking strings and found files with numeric text fail admission; missing-file false with empty, absent or null text remains valid. Unsuccessful-update false, successful empty-text transform, ordinary positive text, wrong-operation replies and absent found text distinguish framing from operation admission; optional unrelated fields remain intact and input records are unchanged.
 * @evidence contracts/testing.md#execution-ownership One discoverable compiler source-unit entry directly imports the production-used namespace and collects independent assertion errors. No files, constructor, native peer, compiler, child or worker are used. Reader trimming/chunk framing, FIFO promise settlement, abort, late lines, disposal and host exit remain external transport/lifecycle observations and are not certified by these operations.
 */
export function test_resident_transform_reply_preserves_frame_and_operation_admission(): void {
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  for (const line of ["not-json", "[]", "42", '"str"', "true", "null"])
    check("frame/" + line, () => assert.equal(ResidentTransformReply.parse(line), undefined));

  const frames: readonly {
    name: string;
    line: string;
    expected: Record<string, unknown>;
    transform: boolean;
    update: boolean;
  }[] = [
    { name: "empty-object", line: '{}', expected: {}, transform: false, update: false },
    { name: "missing-file-empty-text", line: '{"typescript":"","found":false}', expected: { typescript: "", found: false }, transform: true, update: false },
    { name: "missing-file-no-text", line: '{"found":false}', expected: { found: false }, transform: true, update: false },
    { name: "missing-file-irrelevant-text", line: '{"found":false,"typescript":null}', expected: { found: false, typescript: null }, transform: true, update: false },
    { name: "unsuccessful-update", line: '{"updated":false}', expected: { updated: false }, transform: false, update: true },
    { name: "wrong-update-reply-for-transform", line: '{"updated":true}', expected: { updated: true }, transform: false, update: true },
    { name: "found-without-text", line: '{"found":true}', expected: { found: true }, transform: false, update: false },
    { name: "found-numeric-text", line: '{"found":true,"typescript":42}', expected: { found: true, typescript: 42 }, transform: false, update: false },
    { name: "nonboolean-found", line: '{"found":"false","typescript":"x"}', expected: { found: "false", typescript: "x" }, transform: false, update: false },
    { name: "nonboolean-updated", line: '{"updated":"false"}', expected: { updated: "false" }, transform: false, update: false },
    { name: "wrong-transform-reply-for-update", line: '{"found":true,"typescript":"x"}', expected: { found: true, typescript: "x" }, transform: true, update: false },
    { name: "found-empty-text", line: '{"found":true,"typescript":""}', expected: { found: true, typescript: "" }, transform: true, update: false },
    { name: "unrelated-fields-preserved", line: '{"found":true,"typescript":"echo:a.ts","extra":"retained"}', expected: { found: true, typescript: "echo:a.ts", extra: "retained" }, transform: true, update: false },
  ];
  for (const frame of frames) {
    check(frame.name + "/parse", () => assert.deepEqual(ResidentTransformReply.parse(frame.line), frame.expected));
    const before = JSON.stringify(frame.expected);
    check(frame.name + "/transform-admission", () => assert.equal(ResidentTransformReply.isValid(frame.expected, "transform"), frame.transform));
    check(frame.name + "/update-admission", () => assert.equal(ResidentTransformReply.isValid(frame.expected, "update"), frame.update));
    check(frame.name + "/input-preserved", () => assert.equal(JSON.stringify(frame.expected), before));
    check(frame.name + "/parsed-transform-admission", () => {
      const parsed = ResidentTransformReply.parse(frame.line);
      assert.ok(parsed !== undefined);
      assert.equal(ResidentTransformReply.isValid(parsed, "transform"), frame.transform);
    });
    check(frame.name + "/parsed-update-admission", () => {
      const parsed = ResidentTransformReply.parse(frame.line);
      assert.ok(parsed !== undefined);
      assert.equal(ResidentTransformReply.isValid(parsed, "update"), frame.update);
    });
  }
  if (failures.length) throw new AggregateError(failures, "Resident reply policy assertions failed");
}
