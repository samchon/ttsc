import { type ITtscResult, parseResult } from "@ttsc/wasm";
import assert from "node:assert/strict";

/**
 * Verifies result decoding follows JSON values without interpreting exit status
 * or validating the caller's generic schema.
 *
 * Structured payload decoding is portable behavior. Empty and malformed text
 * returns null, while valid false, zero and string values must not be lost to a
 * truthiness check on the decoded result.
 *
 * 1. Decode authored object, array and primitive JSON literals.
 * 2. Decode valid text with a failure exit code and an incompatible generic.
 * 3. Reject empty, whitespace-only, truncated and trailing-content payloads.
 *
 * @evidence contracts/testing.md#behavioral-verification The real parseResult decodes nested objects, arrays and falsy primitive payloads, ignores envelope exit status and does not validate the generic schema. Invalid or absent JSON text returns null rather than throwing or fabricating a payload.
 * @evidence contracts/testing.md#independent-expectations JSON syntax defines the authored literals and invalid texts. Literal object, array, false, zero and empty-string expectations are independently written; the documented parser contract leaves exit code and schema decisions to callers.
 * @evidence contracts/testing.md#distinguishing-cases Object, array, true, false, zero, empty string and JSON null cover value kinds. Empty, whitespace, truncated object and trailing garbage cover absence and syntax failure; nonzero code with valid JSON and incompatible generic distinguish decoding from status or schema validation.
 * @evidence contracts/testing.md#execution-ownership This discoverable test_parse_result_preserves_json_values_and_rejects_invalid_payloads entry calls authored parseResult through the source-unit loader in Node. Each table row retains its input as the assertion message; no installed package, Wasm artifact or Worker runs.
 */
export const test_parse_result_preserves_json_values_and_rejects_invalid_payloads =
  (): void => {
    const envelope = (result: string, code = 0): ITtscResult => ({
      code,
      stdout: "not the payload",
      stderr: "not the payload",
      result,
    });
    const cases: [string, unknown][] = [
      [
        '{"name":"demo","nested":{"items":[1,false,null]}}',
        { name: "demo", nested: { items: [1, false, null] } },
      ],
      ['["x",2]', ["x", 2]],
      ["true", true],
      ["false", false],
      ["0", 0],
      ['""', ""],
      ["null", null],
      ["", null],
      [" \n\t", null],
      ['{"unfinished":', null],
      ["{} trailing", null],
    ];
    for (const [text, expected] of cases)
      assert.deepEqual(parseResult<unknown>(envelope(text)), expected, text);
    assert.deepEqual(
      parseResult<{ accepted: boolean }>(envelope('{"accepted":true}', 3)),
      { accepted: true },
    );
    assert.equal(
      parseResult<{ required: string }>(envelope("7")) as unknown,
      7,
    );
  };
