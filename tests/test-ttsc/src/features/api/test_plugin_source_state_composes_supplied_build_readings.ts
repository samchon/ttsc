import assert from "node:assert/strict";
import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";

/**
 * Verifies source state composition preserves both supplied build readings.
 *
 * The plugin source state is a digest of the source reading and the
 * build-environment reading in a fixed serialization that consumers recompute.
 * Each supplied reading must move the state independently, and an empty reading is
 * a value rather than an absent one.
 *
 * 1. Compose states from source and environment readings, changing each
 *    independently and including empty strings.
 * 2. Pass two spellings of a nonexistent directory so no filesystem reading can
 *    contribute.
 * 3. Compare every state with the SHA-256 reference value of the stated
 *    serialization.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source composer hashes the declared source/environment serialization from supplied readings without reading a nonexistent source directory or launching Go; changing either reading changes the literal expected state.
 * @evidence contracts/testing.md#independent-expectations Literal SHA-256 reference values of the explicitly stated source=<reading> newline environment=<reading> newline serialization establish the expectations independently of the product composer.
 * @evidence contracts/testing.md#distinguishing-cases Source-only change (source-b), environment-only change (environment-b) and the empty-string pair each give a distinct literal digest, and two different nonexistent directory spellings give the same digest, proving the supplied readings are used even when empty ('' is not replaced by a computed fallback). Reading the real source tree or build environment is not exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling pluginSourceState with both readings supplied, so no directory is read and no Go process runs.
 */
export function test_plugin_source_state_composes_supplied_build_readings() {
  for (const [sourceDigest, environment, expected] of [
  [
    "source-a",
    "environment-a",
    "8e03f87a755ab52fb13f3b01a0af2089b99ec2c6168caeb67d9b919759feb2ff"
  ],
  [
    "source-b",
    "environment-a",
    "e30496292127777a7df4906e0d6b7b26fa6eed78beec3f4f9e1a893eb28e842d"
  ],
  [
    "source-a",
    "environment-b",
    "d1cf3d5428f6833a2cc89c317e2f3d53dccc0f6693573a28e650633206723372"
  ],
  [
    "",
    "",
    "c774716e312b73891b8f55ac469d954db8b887a6528d339de920f351004a3738"
  ]
] as const) {
    assert.equal(pluginSourceState("does-not-exist/source", { sourceDigest, environment }), expected);
    assert.equal(pluginSourceState("another/nonexistent/source", { sourceDigest, environment }), expected);
  }
}
