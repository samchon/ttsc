package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverKeepsSemiBeforeASIHazard verifies the rule
// refuses to strip a trailing `;` when the next statement starts with
// an ASI-hazard token.
//
// `const a = b` followed by `;[1, 2].forEach(…)` parses as two
// statements because of the explicit terminator. Removing the `;`
// would re-associate the `[1, 2]` as a member-access on `b`, changing
// program semantics. The rule's fixer applies to one statement at a
// time and cannot synthesize prettier's defensive leading-`;` on the
// next line, so it conservatively keeps the terminator instead of
// stripping it.
//
//  1. Parse a two-statement source where the second statement starts
//     with `[`.
//  2. Run formatSemi configured `prefer: "never"`.
//  3. Assert zero findings — the hazard guard kept the first `;` in
//     place.
func TestFormatSemiPreferNeverKeepsSemiBeforeASIHazard(t *testing.T) {
  source := "const a = 1;\n" +
    "[1, 2].forEach((n) => n);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"formatSemi": SeverityError},
    Options: RuleOptionsMap{
      "formatSemi": json.RawMessage(`{"prefer":"never"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  // The first statement's `;` is followed by `[`, which would parse
  // as `1[1, 2]` if stripped. The rule must keep that terminator.
  // The second statement's `;` is at end-of-file with no following
  // hazard, so it's the only candidate to strip.
  if len(findings) != 1 {
    t.Fatalf("expected exactly 1 finding (only the trailing-EOF semicolon is safe to strip), got %d:\n%v",
      len(findings), findings)
  }
}
