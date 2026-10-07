import { assertGatedOutFilesReachTheUpstreamAsTheOriginalParams } from "../../internal/metro-transform";

/**
 * Verifies a file the gate rejects reaches the upstream as the very params
 * object Metro supplied, which only a bypass of the ttsc pass produces.
 *
 * Equal source text reaching the upstream cannot tell a bypass from a pass that
 * returned its input, so the other pass-through entries cannot catch a gate
 * that stopped rejecting. The ttsc pass forwards a fresh `{ ...params, src }`,
 * so identity with the object given to `transform` is the observable.
 *
 * 1. Install an upstream that records the params it receives.
 * 2. Transform a JavaScript file, a declaration, an excluded file, a file outside
 *    `include`, and a relative file below a project root named like the
 *    include.
 * 3. Assert each time the recorded params are the object that was passed in.
 *
 * @evidence contracts/testing.md#behavioral-verification transform on five gated-out files hands the recording upstream the identical params object, so a gate that let any of them into the ttsc pass would pass a spread copy and fail the identity check; the relative file is gated on its project-relative name, not on the absolute path containing the include word.
 * @evidence contracts/testing.md#independent-expectations The expectation is object identity with the authored params, which follows from the documented bypass (upstream.transform(params)) and not from any transformed output; the gated-in direction is owned by the E2E transform experiments because it needs a native compile.
 * @evidence contracts/testing.md#distinguishing-cases Non-source extension, declaration, exclude, non-matching include and a relative filename whose absolute path would match the include are separate gated-out cases; the positive (compiled) case is not run here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process with a recording CommonJS upstream on disk and nonexistent project files; no native compile, consumer install or Metro host.
 */
export const test_transformer_hands_gated_out_files_to_the_upstream_as_the_original_params =
  async () => {
    await assertGatedOutFilesReachTheUpstreamAsTheOriginalParams();
  };
