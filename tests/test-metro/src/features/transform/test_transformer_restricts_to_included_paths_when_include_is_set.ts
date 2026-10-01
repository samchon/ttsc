import { assertNonIncludedPathPassesThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer restricts to included paths when `include` is set.
 *
 * Pins the include boundary: once any include pattern is configured, a `.ts`
 * file that matches none of them must pass straight through rather than enter
 * the ttsc pass.
 *
 * 1. Configure a single `include` pattern.
 * 2. Run the transformer on a `.ts` file outside that pattern.
 * 3. Assert the upstream received the original source (no ttsc transform).
 *
 * @evidence contracts/testing.md#behavioral-verification transform on /workspace/app/src/other/file.ts with include ["src/included"] hands the fake upstream the original typed source unchanged.
 * @evidence contracts/testing.md#independent-expectations With a non-empty include, a path matching none of the patterns must bypass the ttsc pass, so the authored source must arrive byte-for-byte. Oracle limit: equality of the received source cannot by itself prove that no compile was attempted.
 * @evidence contracts/testing.md#distinguishing-cases Only a non-matching include is run; the matching include and exclude precedence cases are asserted by the gating decisions entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process against a fake CommonJS upstream that echoes its params; the file does not exist on disk and no native compile, consumer install or Metro host is involved.
 */
export const test_transformer_restricts_to_included_paths_when_include_is_set =
  async () => {
    await assertNonIncludedPathPassesThrough();
  };
