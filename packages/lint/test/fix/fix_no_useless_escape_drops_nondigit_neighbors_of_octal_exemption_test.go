package linthost

import "testing"

// TestFixNoUselessEscapeDropsNondigitNeighborsOfOctalExemption verifies
// the negative twins of the backslash-digit exemption still autofix.
//
// The `\1`…`\9` exemption in `isUselessStringEscape` (issue #361) must
// not over-reach: a useless letter escape (`\m`), a useless punctuation
// escape (`\.`), and the ASCII neighbor right above the digit range
// (`\:`, `':' == '9'+1`, which an off-by-one in the range comparison
// would wrongly exempt) sit one property away from the exempted digits
// and must keep being reported and fixed, otherwise the exemption
// silently disables the rule for whole character classes.
//
// 1. Parse string literals containing `\m`, `\.`, and `\:` (no meaningful escape).
// 2. Apply the findings through the disk-backed fixer.
// 3. Assert all three backslashes are gone and nothing else changed.
func TestFixNoUselessEscapeDropsNondigitNeighborsOfOctalExemption(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-useless-escape",
    "const letter = \"a\\mb\";\nconst dot = \"a\\.b\";\nconst colon = \"a\\:b\";\nJSON.stringify({letter,dot,colon});\n",
    "const letter = \"amb\";\nconst dot = \"a.b\";\nconst colon = \"a:b\";\nJSON.stringify({letter,dot,colon});\n",
  )
}
