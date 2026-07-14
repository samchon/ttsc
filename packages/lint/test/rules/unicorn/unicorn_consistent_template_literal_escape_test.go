package linthost

import "testing"

const unicornConsistentTemplateLiteralEscapeRuleName = "unicorn/consistent-template-literal-escape"

// TestRuleCorpusUnicornConsistentTemplateLiteralEscape verifies the corpus
// fixture: every `$\{` / `\$\{` spelling reports while canonical `\${`,
// tagged templates, plain strings, and escaped backslashes stay silent.
//
// The two escape spellings cook to the same token text, so the rule must
// read raw source ranges; this fixture pins the raw-source path across
// no-substitution templates, head/tail elements, template literal types,
// and a multi-line tail whose finding anchors on the tail token's opening
// `}` line, exactly like the upstream TemplateElement report.
//
// 1. Mirror tests/test-lint/src/cases/unicorn-consistent-template-literal-escape.ts.
// 2. Run the native engine with the rule enabled via expect annotations.
// 3. Assert the reported (rule, severity, line) triples match the annotations.
func TestRuleCorpusUnicornConsistentTemplateLiteralEscape(t *testing.T) {
  assertRuleCorpusCase(
    t,
    "unicorn/consistent-template-literal-escape.ts",
    "// expect: unicorn/consistent-template-literal-escape error\n"+
      "const braceEscaped = `link $\\{target}`;\n"+
      "// expect: unicorn/consistent-template-literal-escape error\n"+
      "const bothEscaped = `link \\$\\{target}`;\n"+
      "// expect: unicorn/consistent-template-literal-escape error\n"+
      "// expect: unicorn/consistent-template-literal-escape error\n"+
      "const mixedElements = `$\\{head}${braceEscaped}$\\{tail}`;\n"+
      "// expect: unicorn/consistent-template-literal-escape error\n"+
      "type BraceEscapedType = `$\\{value}${string}`;\n"+
      "// expect: unicorn/consistent-template-literal-escape error\n"+
      "const multiline = `first ${braceEscaped}\n"+
      "second $\\{closing}`;\n"+
      "const canonical = `use \\${target} with ${bothEscaped}`;\n"+
      "const escapedBackslash = `keep \\\\\\${mixedElements}`;\n"+
      "const tagged = String.raw`$\\{canonical}` as BraceEscapedType;\n"+
      "const plainString = \"$\\{escapedBackslash}\" + tagged + multiline;\n"+
      "export default plainString;\n",
  )
}
