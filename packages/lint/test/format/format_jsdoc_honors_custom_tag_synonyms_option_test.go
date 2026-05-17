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
func TestFormatJSDocHonorsCustomTagSynonymsOption(t *testing.T) {
  source := "/**\n * @property name\n * @return greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  want := "/**\n * @prop name\n * @returns greeting\n */\nexport function greet(): string { return \"hi\"; }\n"
  assertFixSnapshotWithOptions(t, "format/jsdoc", source, `{"tagSynonyms":{"property":"prop"}}`, want)
}
