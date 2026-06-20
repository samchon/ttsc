import { assertPassesDeclarationThrough } from "../../internal/metro-transform";

/**
 * Verifies the transformer passes declaration files to the upstream unchanged.
 *
 * The negative twin of the TypeScript-transform path. A `.d.ts` ends in `.ts`
 * but carries only types; feeding it to the ttsc project transform is wasteful
 * and meaningless, so it must pass straight through.
 *
 * 1. Run the transformer on a `.d.ts` file with the fake upstream.
 * 2. Assert the upstream received the original source unchanged.
 */
export const test_transformer_passes_declaration_files_to_the_upstream =
  async () => {
    await assertPassesDeclarationThrough();
  };
