package linthost

import "testing"

// TestFixNoUselessEscapeSkipsTemplateSubstitutionEscape verifies the
// `\${` exception inside template literals for `noUselessEscape`.
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
func TestFixNoUselessEscapeSkipsTemplateSubstitutionEscape(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "noUselessEscape",
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
