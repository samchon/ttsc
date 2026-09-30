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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase compares six exact annotated rule/severity/line findings and rejects extras.
// @evidence contracts/testing.md#independent-expectations Authored annotation lines express upstream raw-template element diagnostic positions, including the multiline tail opening line.
// @evidence contracts/testing.md#distinguishing-cases Brace/both escapes, head/tail, template type and multiline tail report; canonical escape, backslash parity, tagged quasi and plain string remain clean.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit entry executes the literal corpus through the owning engine in the shared process. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
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
