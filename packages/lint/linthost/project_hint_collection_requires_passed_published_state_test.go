package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type hintRuleTestDouble struct {
  name  string
  check func(*publicrule.ProjectContext)
  hints func(*publicrule.HintContext) []publicrule.Hint
}

func (r hintRuleTestDouble) Name() string { return r.name }
func (r hintRuleTestDouble) Check(ctx *publicrule.ProjectContext) {
  if r.check != nil {
    r.check(ctx)
  }
}
func (r hintRuleTestDouble) Hints(ctx *publicrule.HintContext) []publicrule.Hint {
  if r.hints == nil {
    return nil
  }
  return r.hints(ctx)
}

func installHintRuleTestDouble(t *testing.T, project hintRuleTestDouble) {
  t.Helper()
  previous, existed := registeredProjectRules[project.name]
  registeredProjectRules[project.name] = projectRuleAdapter{inner: project, name: project.name}
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[project.name] = previous
    } else {
      delete(registeredProjectRules, project.name)
    }
  })
}

// TestProjectHintCollectionRequiresPassedPublishedState verifies collection
// cannot offer a corpus that its project rule did not finish and endorse.
//
// Off rules never run, failed rules disown the state they built, and a passed
// rule without state published no corpus. Only the passed-and-published rule is
// allowed through, and the call counter proves the other Hints methods were not
// merely called and filtered afterward.
//
//  1. Install off, failed, stateless, and passed hint-rule doubles.
//  2. Evaluate one project cycle and collect its hints.
//  3. Assert only the passed-and-published provider was invoked and retained.
//
// @evidence contracts/testing.md#behavioral-verification Actual project hint collection calls only the passed provider with published state, preserves its literal insert and JSDoc @ trigger, and never invokes off, failed or stateless providers.
// @evidence contracts/testing.md#independent-expectations Authored provider names, state transitions and one-call map independently specify eligibility; literal trigger values define the complete surviving hint instead of accepting only any item.
// @evidence contracts/testing.md#distinguishing-cases Off, failed-with-state, passed-without-state and passed-with-state isolate each eligibility gate. Counters distinguish pre-call rejection from invoking every provider and filtering afterward.
// @evidence contracts/testing.md#execution-ownership Real project evaluation and hint collection execute in-process with restored fixture registration; no native producer, language-server transport, installed consumer or source inspection executes.
func TestProjectHintCollectionRequiresPassedPublishedState(t *testing.T) {
  const (
    failedName    = "hint-test/failed"
    offName       = "hint-test/off"
    passedName    = "hint-test/passed"
    statelessName = "hint-test/stateless"
  )
  calls := map[string]int{}
  install := func(name string, check func(*publicrule.ProjectContext)) {
    installHintRuleTestDouble(t, hintRuleTestDouble{
      name:  name,
      check: check,
      hints: func(*publicrule.HintContext) []publicrule.Hint {
        calls[name]++
        return []publicrule.Hint{{
          Insert: name,
          Trigger: publicrule.HintTrigger{
            Scope: publicrule.HintScopeJSDoc,
            After: "@",
          },
        }}
      },
    })
  }
  install(offName, func(ctx *publicrule.ProjectContext) { ctx.SetState("off") })
  install(failedName, func(ctx *publicrule.ProjectContext) {
    ctx.SetState("failed")
    ctx.Fail()
  })
  install(statelessName, nil)
  install(passedName, func(ctx *publicrule.ProjectContext) { ctx.SetState("passed") })

  engine := NewEngine(RuleConfig{
    failedName:    SeverityError,
    offName:       SeverityOff,
    passedName:    SeverityWarn,
    statelessName: SeverityError,
  })
  hints := collectProjectHints(engine.evaluateProject(publicrule.ProjectIdentity{}, nil, nil))
  if len(hints) != 1 || hints[0].Insert != passedName {
    t.Fatalf("only passed-and-published hints should survive: %#v", hints)
  }
  if len(calls) != 1 || calls[passedName] != 1 {
    t.Fatalf("inactive providers should not be called: %#v", calls)
  }
  if hints[0].Trigger.Scope != publicrule.HintScopeJSDoc || hints[0].Trigger.After != "@" { t.Fatalf("published trigger changed: %#v", hints[0]) }
}
