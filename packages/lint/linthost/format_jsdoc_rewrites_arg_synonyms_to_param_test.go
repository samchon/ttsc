package linthost

import "testing"

// TestFormatJSDocRewritesArgSynonymsToParam verifies both
// `@arg` and `@argument` collapse onto `@param`.
//
// JSDoc documents `@arg` and `@argument` as aliases of `@param`. The
// formatter chooses the canonical spelling while preserving parameter
// names and their descriptions.
// The rule normalizes both onto the canonical name in one rewrite each.
//
// 1. Parse a source file with one JSDoc block using `@arg` and `@argument`.
// 2. Apply the rule's findings through the disk-backed fixer.
// 3. Assert both synonyms become `@param`.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must rewrite both arg and argument to param while preserving their parameter names, descriptions and function body. Complete source catches normalizing only one alias or altering unrelated content.
// @evidence contracts/testing.md#independent-expectations Official JSDoc parameter documentation lists arg and argument as aliases of param. The formatter supported canonical spelling supplies the two literal replacements without consulting its synonym table.
// @evidence contracts/testing.md#distinguishing-cases The same block contains both distinct parameter aliases as positives. SkipsCanonicalTags supplies the canonical param negative, and custom-option tests distinguish table extension and malformed overrides.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocRewritesArgSynonymsToParam owns both tag inputs and the complete expected source in the public Go unit population. The syntax-only owning rule/edit application run in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatJSDocRewritesArgSynonymsToParam(t *testing.T) {
  source := "/**\n * @arg name The recipient name.\n * @argument greeting The greeting prefix.\n */\nexport function greet(name: string, greeting: string): string {\n  return greeting + name;\n}\n"
  expected := "/**\n * @param name The recipient name.\n * @param greeting The greeting prefix.\n */\nexport function greet(name: string, greeting: string): string {\n  return greeting + name;\n}\n"
  assertFixSnapshot(t, "format/jsdoc", source, expected)
}
