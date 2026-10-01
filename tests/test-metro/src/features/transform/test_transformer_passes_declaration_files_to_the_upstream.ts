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
 * @evidence contracts/testing.md#behavioral-verification transform on /workspace/app/src/types.d.ts hands the fake upstream the original declaration source unchanged.
 * @evidence contracts/testing.md#independent-expectations The authored declaration text must arrive byte-for-byte because declaration files are excluded from the ttsc pass. Oracle limit: equality of the received source cannot by itself prove that no compile was attempted.
 * @evidence contracts/testing.md#distinguishing-cases Only the .d.ts boundary is run; JavaScript pass-through and admitted TypeScript are separate entries, and shouldTransform's declaration rejections are asserted in the decisions entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process against a fake CommonJS upstream that echoes its params; no native compile, consumer install or Metro host.
 */
export const test_transformer_passes_declaration_files_to_the_upstream =
  async () => {
    await assertPassesDeclarationThrough();
  };
