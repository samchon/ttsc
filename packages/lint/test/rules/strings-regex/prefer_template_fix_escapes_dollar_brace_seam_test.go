package linthost

import "testing"

// TestFixPreferTemplateEscapesDollarBraceSeam verifies that a `$` ending
// one literal operand and a `{` starting the next cannot fuse into a
// live `${` interpolation: `"$" + "{" + n` → “ `\${${n}` “.
//
// Escaping each literal segment on its own cannot see across the seam —
// `escapeTemplateLiteralBody("$")` leaves the `$` bare because the `{`
// lives in the NEXT segment, so the joined body would open a real
// interpolation and the fix output would not even re-parse. The
// renderer must merge adjacent literal operands into one cooked run
// before escaping, producing `\${` whose cooked value stays "${".
//
// 1. Snapshot a chain whose literals spell `$` then `{` back to back.
// 2. Apply `prefer-template` fix.
// 3. Assert the seam is escaped and the cooked value is preserved.
func TestFixPreferTemplateEscapesDollarBraceSeam(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const n: any = 1;\nconst s = \"$\" + \"{\" + n;\nJSON.stringify(s);\n",
    "const n: any = 1;\nconst s = `\\${${n}`;\nJSON.stringify(s);\n",
  )
}
