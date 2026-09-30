package linthost

import "testing"

// TestFixNoUselessEscapeSkipsTemplateSubstitutionEscape verifies the
// `\${` exception inside template literals for `no-useless-escape`.
//
// Inside a template literal `\${` escapes the substitution opener so the
// next two source bytes appear as literal `${` instead of starting a
// `${expr}` interpolation. Stripping the backslash would either turn the
// literal text into an interpolation (corrupting the program) or — when
// the same template already contains a real interpolation — produce TS
// syntax that no longer parses, e.g. “ `\${${k}}` “ would collapse to
// “ `${${k}}` “ which is a syntax error. This case pins the rule's
// silence for every template-literal shape that can carry the escape:
// `NoSubstitutionTemplateLiteral`, `TemplateHead`, `TemplateMiddle`, and
// `TemplateTail`. The companion finding for `\n` / `\\` stays unflagged
// because both characters live in `templateValidEscapes`, so the
// regression test also guards that the surrounding whitelist is intact.
//
//  1. Parse template literals that pair `\${` with each template-token
//     shape (no-substitution, head, middle, tail) plus a `\n` and `\\`
//     control to confirm the unrelated escapes still pass through.
//  2. Run the rule under the engine and confirm zero findings — the
//     fix path is never reached, so the source must stay byte-identical.
//  3. Source stays byte-identical (no autofix applied).
//
// @evidence contracts/testing.md#behavioral-verification The escape rule emits no findings for escaped substitution openers across head, middle, tail and no-substitution templates.
// @evidence contracts/testing.md#independent-expectations Literal escaped dollar/brace text must remain text rather than interpolation; newline and backslash literals are independent valid-escape controls.
// @evidence contracts/testing.md#distinguishing-cases All four template token forms and two ordinary valid escapes are owned here; useless ordinary letter escapes remain positive elsewhere.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessEscapeSkipsTemplateSubstitutionEscape calls assertRuleSkipsSource on all six literals in one parser/Engine execution.
func TestFixNoUselessEscapeSkipsTemplateSubstitutionEscape(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-escape",
    "const k = \"x\";\n"+
      "const head = `\\${${k}}`;\n"+
      "const nosub = `\\${k}`;\n"+
      "const middle = `${k}\\${${k}}`;\n"+
      "const tail = `${k}\\${k}`;\n"+
      "const newline = `line1\\nline2`;\n"+
      "const backslash = `path\\\\file`;\n"+
      "JSON.stringify({head,nosub,middle,tail,newline,backslash});\n",
  )
}
