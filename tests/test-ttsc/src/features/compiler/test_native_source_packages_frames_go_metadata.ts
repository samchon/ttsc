import assert from "node:assert/strict";

import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";

/**
 * Verifies Go package metadata streams retain independent records and errors.
 *
 * Go emits adjacent JSON objects rather than an array. Braces and escaped
 * quotes inside diagnostics must not split a record or hide package errors.
 *
 * 1. Parse whitespace, adjacent records and escaped diagnostic content.
 * 2. Reject malformed framing and invalid package field shapes.
 * 3. Admit only error-free packages with selected production files.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual metadata parser and kind admission, comparing complete records and ownership; malformed streams, invalid field types, Go errors and test-only selections throw.
 * @evidence contracts/testing.md#independent-expectations Literal JSON records and package identities establish expected values; the expected diagnostic is preserved byte-for-byte after JSON decoding.
 * @evidence contracts/testing.md#distinguishing-cases Owns adjacent and whitespace-separated records, nested Error, braces and escaped quotes/backslashes in strings, empty stream, incomplete/trailing/non-object JSON, invalid scalar/file/error fields, main/library/cgo-only production and no-production rejection.
 * @evidence contracts/testing.md#execution-ownership Imports the authored parser and admission functions directly; no process, filesystem fixture, compiler preparation or native artifact is involved.
 */
export function test_native_source_packages_frames_go_metadata(): void {
  const first = { Dir: "native/path", Name: "library", GoFiles: ["actual.go"] };
  const second = { Dir: "another/path", Name: "main", Error: {
    Err: 'found {package} "main" beside \\library',
  } };
  assert.deepEqual(
    NativeSourcePackages.parse(` \n${JSON.stringify(first)}${JSON.stringify(second)}\t`),
    [first, second],
  );
  assert.deepEqual(NativeSourcePackages.parse(" \r\n\t"), []);
  for (const text of ["[]", "null", "{}junk", "{", '{"Dir":', '{"Name":7}',
    '{"GoFiles":"actual.go"}', '{"CgoFiles":[1]}', '{"Error":null}', '{"Error":{}}'])
    assert.throws(() => NativeSourcePackages.parse(text), Error, text);
  assert.equal(NativeSourcePackages.kind(first, "library"), "linked");
  assert.equal(NativeSourcePackages.kind({ Name: "main", GoFiles: ["main.go"] }, "main"), "executable");
  assert.equal(NativeSourcePackages.kind({ Name: "library", CgoFiles: ["cgo.go"] }, "cgo"), "linked");
  assert.throws(() => NativeSourcePackages.kind(second, "invalid"), {
    message: `ttsc: plugin "invalid" Go package selection failed: ${second.Error.Err}`,
  });
  assert.throws(() => NativeSourcePackages.kind({ Name: "library" }, "test-only"), /no Go-selected production files/);
  assert.throws(() => NativeSourcePackages.kind({ GoFiles: ["actual.go"] }, "no-name"), /no Go-selected production files/);
}
