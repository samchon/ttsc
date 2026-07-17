package linthost

import (
  "fmt"
  "os"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// collectProjectHints gathers the editor-completion corpus every declared
// project rule published for this Program.
//
// It runs after evaluateProject rather than inside it, because a corpus is a
// projection of finished state: asking mid-check would publish whatever the rule
// had indexed so far. Nothing calls this during `ttsc check`, so a rule's Hints
// is never invoked, and its corpus never allocated, unless an editor asks.
//
// A rule is asked only when it passed and published state — the same gate a file
// rule writes by hand against ProjectRulePassed. A rule that failed produced a
// corpus describing a Program it just rejected, and offering that would complete
// against facts the rule itself disowns.
func collectProjectHints(cycle *projectCycle) []publicrule.Hint {
  if cycle == nil || cycle.results == nil {
    return nil
  }
  hints := []publicrule.Hint{}
  for _, name := range allProjectRuleNames() {
    result, exists := cycle.results.byName[name]
    if !exists || result.reporter == nil {
      continue
    }
    adapter, registered := registeredProjectRules[name]
    if !registered {
      continue
    }
    provider, ok := adapter.inner.(publicrule.HintRule)
    if !ok {
      continue
    }
    snapshot := result.reporter.snapshot()
    if snapshot.Status != publicrule.ProjectRulePassed || snapshot.State == nil {
      continue
    }
    hints = append(hints, ruleHints(name, provider, result, snapshot)...)
  }
  return hints
}

// ruleHints calls one rule's Hints behind a recover barrier and drops the hints
// a rule cannot have meant.
//
// The barrier matches the metadata-inspection contract: a contributor panicking
// while describing itself loses its contribution rather than the process. This
// path is worse than most to leave unguarded — it runs inside an editor session,
// where a crash is not a failed build but a language server that stopped
// answering.
func ruleHints(
  name string,
  provider publicrule.HintRule,
  result projectCycleResult,
  snapshot publicrule.ProjectRuleResult,
) (hints []publicrule.Hint) {
  defer func() {
    if recovered := recover(); recovered != nil {
      fmt.Fprintf(
        os.Stderr,
        "@ttsc/lint: project rule %q panicked while publishing hints: %v; dropping its corpus\n",
        name,
        recovered,
      )
      hints = nil
    }
  }()
  published := provider.Hints(&publicrule.HintContext{
    Identity: result.identity,
    State:    snapshot.State,
    Severity: publicrule.Severity(result.severity),
    Options:  result.options,
  })
  kept := make([]publicrule.Hint, 0, len(published))
  for _, hint := range published {
    if !usableHint(hint) {
      continue
    }
    kept = append(kept, hint)
  }
  return kept
}

// usableHint reports whether a hint can be offered at all.
//
// A hint with no scope would apply anywhere on any line, which is never what a
// rule meant — it would surface in every decorator and every string literal — so
// it is dropped rather than honored. A hint with no After is the same mistake
// spelled differently: it matches every line in scope, so the corpus fires on an
// empty doc comment. An empty Insert completes to nothing.
func usableHint(hint publicrule.Hint) bool {
  return hint.Insert != "" &&
    hint.Trigger.Scope != "" &&
    hint.Trigger.After != ""
}
