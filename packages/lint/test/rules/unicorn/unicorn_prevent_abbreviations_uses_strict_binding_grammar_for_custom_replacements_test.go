package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesStrictBindingGrammarForCustomReplacements verifies that the identifier predicate checks literal reserved/contextual word sets, and the fixer checks authored eval_/type outputs.
//
// ECMAScript strict binding restrictions and TypeScript contextual keyword grammar independently distinguish invalid reserved names from valid context words.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The identifier predicate checks literal reserved/contextual word sets, and the fixer checks authored eval_/type outputs.
// @evidence contracts/testing.md#independent-expectations ECMAScript strict binding restrictions and TypeScript contextual keyword grammar independently distinguish invalid reserved names from valid context words.
// @evidence contracts/testing.md#distinguishing-cases All retained reserved/contextual words remain; eval replacement gains a suffix while type is used directly.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesStrictBindingGrammarForCustomReplacements owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsUsesStrictBindingGrammarForCustomReplacements(t *testing.T) {
  for _, name := range []string{
    "arguments", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "enum", "eval", "export",
    "extends", "false", "finally", "for", "function", "if", "implements", "import",
    "in", "instanceof", "interface", "let", "new", "null", "package", "private",
    "protected", "public", "return", "static", "super", "switch", "this", "throw",
    "true", "try", "typeof", "var", "void", "while", "with", "yield",
  } {
    if unicornPreventAbbreviationsValidIdentifier(name) {
      t.Fatalf("strict binding reserved word %q must not be used directly", name)
    }
  }
  for _, name := range []string{
    "any", "as", "boolean", "constructor", "declare", "from", "get", "module",
    "number", "of", "require", "set", "string", "symbol", "type",
  } {
    if !unicornPreventAbbreviationsValidIdentifier(name) {
      t.Fatalf("contextual TypeScript keyword %q is a valid binding name", name)
    }
  }

  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "export {};\nconst err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"eval":true}}}`,
    "export {};\nconst eval_ = new Error();\nvoid eval_;\n",
  )
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"type":true}}}`,
    "const type = new Error();\nvoid type;\n",
  )
}
