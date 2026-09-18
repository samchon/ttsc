import assert from "node:assert";

import { isDeclarationFile } from "../../../../../packages/unplugin/lib/core/transform/utils/isDeclarationFile.js";

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
 */
export async function test_transformttsc_declaration_classification_is_separator_neutral(): Promise<void> {
  assert.equal(isDeclarationFile("C:\\repo.d.cache\\src\\main.ts"), false);
  assert.equal(isDeclarationFile("/repo.d.cache/src/main.ts"), false);
  assert.equal(isDeclarationFile("C:\\repo\\src\\types.d.css.ts"), true);
  assert.equal(isDeclarationFile("/repo/src/types.d.css.ts"), true);
}
