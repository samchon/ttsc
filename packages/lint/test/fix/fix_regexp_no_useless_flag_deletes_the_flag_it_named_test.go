package linthost

import (
  "strings"
  "testing"
)

// TestFixRegexpNoUselessFlagDeletesTheFlagItNamed verifies
// `regexp/no-useless-flag` deletes exactly the dead flags its analysis
// identified and names them in the diagnostic.
//
// The analysis already decided which of `i` and `m` the pattern cannot
// exercise, and it is one-sided: anything it cannot settle counts as using the
// flag, so a flag that reaches the fix is provably inert and the deletion is
// safe to impose. The load-bearing part is that the live flags around it
// survive — a whole-run rewrite would take `g` with it.
//
//  1. Fix `/\d+/gim`, where `g` is live and both `i` and `m` are dead.
//  2. Assert only `g` remains and the message names both dead flags.
//  3. Assert the negative twins keep their flag: `/[a-z]/i`, where `i` is what
//     extends the class, and `/^a$/m`, which has anchors for `m` to re-define.
func TestFixRegexpNoUselessFlagDeletesTheFlagItNamed(t *testing.T) {
  assertFixSnapshot(
    t,
    "regexp/no-useless-flag",
    "const value = /\\d+/gim;\nJSON.stringify(value);\n",
    "const value = /\\d+/g;\nJSON.stringify(value);\n",
  )
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "regexp/no-useless-flag",
    "const value = /\\d+/gim;\nJSON.stringify(value);\n",
    nil,
  )
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  expected := "Unexpected useless regular expression flags `i` and `m`."
  if findings[0].Message != expected {
    t.Fatalf("message:\nwant %q\ngot  %q", expected, findings[0].Message)
  }

  assertFixSnapshot(
    t,
    "regexp/no-useless-flag",
    "const value = /\\d/i;\nJSON.stringify(value);\n",
    "const value = /\\d/;\nJSON.stringify(value);\n",
  )
  _, _, single := runRuleFindingsSnapshot(
    t,
    "regexp/no-useless-flag",
    "const value = /\\d/i;\nJSON.stringify(value);\n",
    nil,
  )
  if len(single) != 1 || !strings.Contains(single[0].Message, "flag `i`.") {
    t.Fatalf("single-flag message = %+v", single)
  }

  assertRuleSkipsSource(
    t,
    "regexp/no-useless-flag",
    "const value = /[a-z]/i;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-useless-flag",
    "const value = /^a$/m;\nJSON.stringify(value);\n",
  )
}
