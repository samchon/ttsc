import { assertExcludedPathPassesThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer excludes configured paths from the ttsc pass.
 *
 * The negative twin of a transformed file: identical `.ts` extension, but a
 * path matching an `exclude` substring must bypass the ttsc pass and reach the
 * upstream with its source unchanged.
 *
 * 1. Run the transformer on a `.ts` file whose path matches an `exclude` pattern.
 * 2. Assert the upstream received the original source (no ttsc transform).
 *
 * @evidence contracts/testing.md#behavioral-verification transform on /workspace/app/src/generated/api.ts with exclude ["generated"] hands the fake upstream the original typed source unchanged.
 * @evidence contracts/testing.md#independent-expectations Exclude is a substring filter applied before compilation, and the authored source text must reach the upstream byte-for-byte. Oracle limit: equality of the received source cannot by itself prove that no compile was attempted.
 * @evidence contracts/testing.md#distinguishing-cases Only an excluded .ts path is run; the admitted-TypeScript compile path and the include filter are not exercised in this body.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process against a fake CommonJS upstream that echoes its params; the file does not exist on disk and no native compile, consumer install or Metro host is involved.
 */
export const test_transformer_excludes_configured_paths_from_the_ttsc_pass =
  async () => {
    await assertExcludedPathPassesThrough();
  };
