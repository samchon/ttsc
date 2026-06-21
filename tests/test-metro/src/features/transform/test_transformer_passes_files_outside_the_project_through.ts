import { assertOutsideProjectFilePassesThrough } from "../../internal/metro-transform";

/**
 * Verifies a file outside the tsconfig program passes through untransformed.
 *
 * When the ttsc pass is asked for a file not in the compiled program it throws
 * "…did not return output…"; that is not a build error, so the transformer must
 * swallow it and hand the original source downstream. Exercises the real native
 * compiler (Go source plugin) → runs in CI.
 *
 * 1. Create the fixture project and a stray `.ts` file outside its `src/`.
 * 2. Transform the stray file (relative path + projectRoot).
 * 3. Assert the upstream received the original, untransformed source.
 */
export const test_transformer_passes_files_outside_the_project_through =
  async () => {
    await assertOutsideProjectFilePassesThrough();
  };
