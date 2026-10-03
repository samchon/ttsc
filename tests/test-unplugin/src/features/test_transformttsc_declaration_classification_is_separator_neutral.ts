import assert from "node:assert";

import { isDeclarationFile } from "../../../../packages/unplugin/src/core/transform/utils/isDeclarationFile";

/**
 * Verifies declaration-file classification ignores which separator a module id
 * uses.
 *
 * Module ids can cross platforms, for example a Windows id inspected by a POSIX
 * host. TypeScript-Go normalizes both separators before taking the basename, so
 * a `.d.` directory component must never turn an ordinary source into a
 * declaration, while an arbitrary-extension declaration such as
 * `types.d.css.ts` still is one.
 *
 * 1. Classify ordinary sources below a `.d.cache` directory with backslash and
 *    slash separators.
 * 2. Classify `types.d.css.ts` with both separators.
 * 3. Assert only the arbitrary-extension declarations are declarations.
 *
 * @evidence contracts/testing.md#behavioral-verification isDeclarationFile classifies arbitrary-extension declarations while refusing ordinary source under a .d.cache directory for both separators.
 * @evidence contracts/testing.md#independent-expectations Literal false/true pairs follow TypeScript declaration basenames; directory substrings alone cannot identify a declaration.
 * @evidence contracts/testing.md#distinguishing-cases Windows and POSIX spellings each include one ordinary-source negative and one types.d.css.ts positive, exercising separator normalization in one process.
 * @evidence contracts/testing.md#execution-ownership This entry invokes isDeclarationFile directly on four module IDs; it uses no filesystem, compiler or OS-specific execution.
 */
export async function test_transformttsc_declaration_classification_is_separator_neutral(): Promise<void> {
  assert.equal(isDeclarationFile("C:\\repo.d.cache\\src\\main.ts"), false);
  assert.equal(isDeclarationFile("/repo.d.cache/src/main.ts"), false);
  assert.equal(isDeclarationFile("C:\\repo\\src\\types.d.css.ts"), true);
  assert.equal(isDeclarationFile("/repo/src/types.d.css.ts"), true);
}
