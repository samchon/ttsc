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
 *
 * @evidence contracts/testing.md#behavioral-verification The authored transformer delivers declaration source unchanged to its upstream.
 * @evidence contracts/testing.md#independent-expectations Declaration inputs carry no runtime code and the literal original source supplies the equality oracle.
 * @evidence contracts/testing.md#distinguishing-cases A d.ts input is the declaration boundary, distinct from ordinary JavaScript and native TypeScript sources.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_passes_declaration_files_to_the_upstream =
  async () => {
    await assertPassesDeclarationThrough();
  };
