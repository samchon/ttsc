import assert from "node:assert";

import { isDeclarationFile } from "../../../../../packages/unplugin/lib/core/transform.js";

/**
 * Verifies declaration-file classification is separator-neutral.
 *
 * Bundler ids can use the producing platform's separator. A POSIX host must not
 * mistake `.d.` in a Windows directory component for the declaration marker
 * that TypeScript-Go recognizes only in the basename.
 *
 * 1. Classify ordinary Windows- and POSIX-style sources below a `.d.` directory.
 * 2. Assert both remain transformable implementation files.
 * 3. Assert arbitrary-extension declarations stay excluded with either style.
 */
export function test_transformttsc_declaration_classification_is_separator_neutral(): void {
  assert.equal(isDeclarationFile("C:\\repo.d.cache\\src\\main.ts"), false);
  assert.equal(isDeclarationFile("/repo.d.cache/src/main.ts"), false);
  assert.equal(isDeclarationFile("C:\\repo\\src\\types.d.css.ts"), true);
  assert.equal(isDeclarationFile("/repo/src/types.d.css.ts"), true);
}
