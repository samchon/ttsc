package linthost

import "testing"

// TestFormatJSDocRewritesArgSynonymsToParam verifies both
// `@arg` and `@argument` collapse onto `@param`.
//
// JSDoc historically allowed three synonyms for parameter docs:
// `@arg`, `@argument`, and `@param`. Modern tooling reads only `@param`;
// the others are kept for backward compatibility but treated as legacy.
// The rule normalizes both onto the canonical name in one rewrite each.
//
// 1. Parse a source file with one JSDoc block using `@arg` and `@argument`.
// 2. Apply the rule's findings through the disk-backed fixer.
// 3. Assert both synonyms become `@param`.
func TestFormatJSDocRewritesArgSynonymsToParam(t *testing.T) {
  source := "/**\n * @arg name The recipient name.\n * @argument greeting The greeting prefix.\n */\nexport function greet(name: string, greeting: string): string {\n  return greeting + name;\n}\n"
  expected := "/**\n * @param name The recipient name.\n * @param greeting The greeting prefix.\n */\nexport function greet(name: string, greeting: string): string {\n  return greeting + name;\n}\n"
  assertFixSnapshot(t, "format/jsdoc", source, expected)
}
