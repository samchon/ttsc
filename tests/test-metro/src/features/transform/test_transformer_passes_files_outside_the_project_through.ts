import { assertOutsideProjectFilePassesThrough } from "../../internal/metro-transform";

/**
 * Verifies a file outside the tsconfig program passes through untransformed.
 *
 * A file the compiled program does not contain is not a build error. The shared
 * `@ttsc/unplugin` core decides that once for every adapter and returns
 * `undefined`, exactly as it does for a module ttsc leaves unchanged, so this
 * transformer hands the original source downstream with no special case of its
 * own. It used to recognise the condition by searching the error text, which is
 * how one product came to hold two different answers to it, with every unplugin
 * adapter failing the build for what this one called non-fatal
 * (samchon/ttsc#1308). Exercises the real native compiler (Go source plugin) →
 * runs in CI.
 *
 * 1. Create the fixture project and a stray `.ts` file outside its `src/`.
 * 2. Transform the stray file (relative path + projectRoot).
 * 3. Assert the upstream received the original, untransformed source.
 */
export const test_transformer_passes_files_outside_the_project_through =
  async () => {
    await assertOutsideProjectFilePassesThrough();
  };
