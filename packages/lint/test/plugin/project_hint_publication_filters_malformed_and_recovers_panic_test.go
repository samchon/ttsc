package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectHintPublicationFiltersMalformedAndRecoversPanic verifies a broken
// provider loses only the unusable corpus it published.
//
// Empty insert text, scope, or trigger literal would create a completion that
// fires too broadly or inserts nothing, while a panic must not terminate the
// editor-facing sidecar. The direct ruleHints seam isolates both policies from
// project evaluation so each failure mode is intentional.
//
//  1. Publish one valid hint alongside every degenerate shape.
//  2. Assert only the valid item remains in its original order.
//  3. Panic from Hints and assert recovery returns no items and logs the rule.
func TestProjectHintPublicationFiltersMalformedAndRecoversPanic(t *testing.T) {
  valid := publicrule.Hint{
    Insert: "valid",
    Trigger: publicrule.HintTrigger{
      Scope: publicrule.HintScopeJSDoc,
      After: "@",
    },
  }
  malformed := hintRuleTestDouble{
    name: "hint-test/malformed",
    hints: func(*publicrule.HintContext) []publicrule.Hint {
      return []publicrule.Hint{
        {},
        {Insert: "missing-scope", Trigger: publicrule.HintTrigger{After: "@"}},
        {Insert: "missing-after", Trigger: publicrule.HintTrigger{Scope: publicrule.HintScopeJSDoc}},
        valid,
      }
    },
  }
  snapshot := publicrule.ProjectRuleResult{Status: publicrule.ProjectRulePassed, State: "ready"}
  hints := ruleHints(malformed.name, malformed, projectCycleResult{}, snapshot)
  if len(hints) != 1 || hints[0] != valid {
    t.Fatalf("malformed hints should be dropped without disturbing valid items: %#v", hints)
  }

  panicking := hintRuleTestDouble{
    name: "hint-test/panicking",
    hints: func(*publicrule.HintContext) []publicrule.Hint {
      panic("hint boom")
    },
  }
  var recovered []publicrule.Hint
  code, stdout, stderr := captureCommandOutput(t, func() int {
    recovered = ruleHints(panicking.name, panicking, projectCycleResult{}, snapshot)
    return 0
  })
  if code != 0 || stdout != "" || len(recovered) != 0 ||
    !strings.Contains(stderr, `project rule "hint-test/panicking" panicked while publishing hints: hint boom`) {
    t.Fatalf("panic recovery mismatch: code=%d stdout=%q stderr=%q hints=%#v", code, stdout, stderr, recovered)
  }
}
