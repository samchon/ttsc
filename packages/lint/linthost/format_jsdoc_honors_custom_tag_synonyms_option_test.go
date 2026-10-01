package linthost

import "testing"

// TestFormatJSDocHonorsCustomTagSynonymsOption verifies the
// `tagSynonyms` option layers on top of the built-in synonym table.
//
// User-supplied entries must augment the defaults, not replace them, so a
// project can normalize a private convention (here `@property` → `@prop`)
// without losing the standard `@return` → `@returns` rewrite. This pins
// the merge semantics.
//
//  1. Configure a custom synonym not in the default table.
//  2. Run the rule against a block exercising both the custom synonym and
//     a default one.
//  3. Assert both rewrites land.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must rewrite property to prop and return to returns in one comment. Complete source detects replacing the built-in table with the custom table and preserves both tag descriptions and function code.
// @evidence contracts/testing.md#independent-expectations The supported tagSynonyms option augments the built-in canonical aliases. Literal expected prop and returns spellings follow that option contract and JSDoc canonical return naming, independently of the implementation synonym map.
// @evidence contracts/testing.md#distinguishing-cases The block contains both a valid custom alias and a built-in alias. RejectsMalformedTagSynonymValue covers invalid custom values, while SkipsCanonicalTags covers already canonical spellings.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocHonorsCustomTagSynonymsOption owns its source, option and literal complete output in the public Go unit population. The syntax-only owning rule and edit harness run in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatJSDocHonorsCustomTagSynonymsOption(t *testing.T) {
  source := "/**\n * @property name\n * @return greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  want := "/**\n * @prop name\n * @returns greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  assertFixSnapshotWithOptions(t, "format/jsdoc", source, `{"tagSynonyms":{"property":"prop"}}`, want)
}
