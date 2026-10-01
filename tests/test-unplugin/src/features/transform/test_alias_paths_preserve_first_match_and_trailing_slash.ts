import assert from "node:assert/strict";
import path from "node:path";
import { createAliasPaths } from "../../../../../packages/unplugin/src/core/transform/alias/createAliasPaths";
/**
 * Verifies first-match alias ownership despite TypeScript longest-key selection.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createAliasPaths for duplicates, overlapping prefixes and asymmetric trailing-slash declarations.
 * @evidence contracts/testing.md#independent-expectations The first and second absolute replacement directories are authored; literal mappings express the independent Vite first-match contract.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate, short-first/long-first, find-only/both trailing slash, and unsupported first-match declarations distinguish precedence and over-admission.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
 */

export function test_alias_paths_preserve_first_match_and_trailing_slash(): void {
  const first = path.resolve("/alias-first").replace(/\\/g, "/");
  const second = path.resolve("/alias-second").replace(/\\/g, "/");
  const aliases = (find: string, replacement: string) => ({ find, replacement });
  const duplicate = createAliasPaths([aliases("@x", first), aliases("@x", second)]);
  assert.deepEqual(duplicate["@x"], [first]);
  assert.deepEqual(duplicate["@x/*"], [first + "/*"]);
  const short = createAliasPaths([aliases("@x", first), aliases("@x/sub", second)]);
  assert.deepEqual(short["@x/sub"], [first + "/sub"]);
  assert.deepEqual(short["@x/sub/*"], [first + "/sub/*"]);
  const long = createAliasPaths([aliases("@x/sub", second), aliases("@x", first)]);
  assert.deepEqual(long["@x/sub"], [second]);
  assert.deepEqual(long["@x/*"], [first + "/*"]);
  const findOnly = createAliasPaths([aliases("@x/", first)]);
  assert.equal(findOnly["@x"], undefined);
  assert.equal(findOnly["@x/"], undefined);
  assert.equal(findOnly["@x/*"], undefined);
  assert.deepEqual(findOnly["@x//*"], [first + "/*"]);
  const both = createAliasPaths([aliases("@x/", first + "/")]);
  assert.deepEqual(both["@x"], [first]);
  assert.deepEqual(both["@x/*"], [first + "/*"]);
  const unsupportedFirst = createAliasPaths([aliases("@x", "../unit/transform/relative"), aliases("@x/sub", second)]);
  assert.equal(unsupportedFirst["@x/sub"], undefined);
}
