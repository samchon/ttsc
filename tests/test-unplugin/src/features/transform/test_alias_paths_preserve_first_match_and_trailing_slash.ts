import assert from "node:assert/strict";
import path from "node:path";

import { createAliasPaths } from "../../../../../packages/unplugin/src/core/transform/alias/createAliasPaths";

/**
 * Verifies first-match alias ownership despite TypeScript longest-key
 * selection.
 *
 * Aliases are consulted in declaration order, so the first match owns a name
 * even where the compiler would pick the longest key, and a trailing slash on
 * either side is normalized without inventing an exact key.
 *
 * 1. Create paths from duplicate, short-before-long and long-before-short alias
 *    lists and require the first declaration to own each exact and wildcard
 *    key.
 * 2. Create paths from aliases that differ by a trailing slash and require the
 *    omitted ordinary prefix keys and the paired-slash exact/wildcard keys.
 * 3. Create paths from an unsupported relative replacement and require its
 *    sub-alias to stay undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createAliasPaths for duplicates, overlapping prefixes and asymmetric trailing-slash declarations.
 * @evidence contracts/testing.md#independent-expectations Authored first and second absolute replacement directories and literal mappings express declaration-order ownership. A find-only trailing slash must not admit ordinary @x and @x/* keys; this case does not certify the implementation's unusable double-slash mapping as a supported Vite translation.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate, short-first/long-first, find-only/both trailing slash, and unsupported first-match declarations distinguish precedence and over-admission.
 * @evidence contracts/testing.md#execution-ownership Unit test: one synchronous function calls createAliasPaths directly on in-memory alias lists (absolute replacements built with path.resolve plus one relative replacement) and compares the returned paths records. No Vite config, filesystem access, consumer or native producer is involved; the relative-replacement case also makes createAliasPaths write a one-time notice to stderr.
 */
export function test_alias_paths_preserve_first_match_and_trailing_slash(): void {
  const first = path.resolve("/alias-first").replace(/\\/g, "/");
  const second = path.resolve("/alias-second").replace(/\\/g, "/");
  const aliases = (find: string, replacement: string) => ({
    find,
    replacement,
  });
  const duplicate = createAliasPaths([
    aliases("@x", first),
    aliases("@x", second),
  ]);
  assert.deepEqual(duplicate["@x"], [first]);
  assert.deepEqual(duplicate["@x/*"], [first + "/*"]);
  const short = createAliasPaths([
    aliases("@x", first),
    aliases("@x/sub", second),
  ]);
  assert.deepEqual(short["@x/sub"], [first + "/sub"]);
  assert.deepEqual(short["@x/sub/*"], [first + "/sub/*"]);
  const long = createAliasPaths([
    aliases("@x/sub", second),
    aliases("@x", first),
  ]);
  assert.deepEqual(long["@x/sub"], [second]);
  assert.deepEqual(long["@x/*"], [first + "/*"]);
  const findOnly = createAliasPaths([aliases("@x/", first)]);
  assert.equal(findOnly["@x"], undefined);
  assert.equal(findOnly["@x/"], undefined);
  assert.equal(findOnly["@x/*"], undefined);
  const both = createAliasPaths([aliases("@x/", first + "/")]);
  assert.deepEqual(both["@x"], [first]);
  assert.deepEqual(both["@x/*"], [first + "/*"]);
  const unsupportedFirst = createAliasPaths([
    aliases("@x", "../unit/transform/relative"),
    aliases("@x/sub", second),
  ]);
  assert.equal(unsupportedFirst["@x/sub"], undefined);
}
