package linthost

import (
  "fmt"
  "os"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// RunLSPHints prints the editor-completion corpus every project rule published
// for this project, as JSON.
//
// Unlike the other LSP verbs this takes no `--uri`: a corpus describes the
// Program, not a document. It loads a Program only when the resolved config
// declares a rule that can publish one, because a corpus is a projection of what
// a project rule's Check found — which is why the caller is expected to cache
// the answer and ask again only when the Program's inputs changed, never per
// editor request.
//
// An empty corpus is a successful answer. A project with no hint-publishing rule
// is the common case, and a caller must be able to tell it apart from a failure;
// a nonzero exit here would read as "the project is broken".
func RunLSPHints(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-hints", args)
  if !ok {
    return 2
  }
  hints, code := computeLSPHints(opts)
  if code != 0 {
    return code
  }
  return writeJSON(hints)
}

// computeLSPHints builds the corpus for one project. Split from RunLSPHints so
// the resident lsp-serve loop reuses it over a warm Program, the same split
// computeLSPDiagnostics and computeLSPCodeActions already take.
func computeLSPHints(opts *lspCommandOptions) ([]publicrule.Hint, int) {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  publishes, needsChecker := engine.hasHintPublisher()
  if !publishes {
    // Nothing the config declared can publish a corpus, so there is no
    // projection to take and the Program is never built. A project with no
    // hint-publishing rule is the common case, and it used to pay a full parse
    // and bind — and a checker build, when any unrelated file rule was
    // type-aware — to arrive at this same empty answer.
    return []publicrule.Hint{}, 0
  }
  prog, parseDiags, closeProgram, err := acquireProgram(opts, needsChecker)
  if closeProgram != nil {
    defer closeProgram()
  }
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return nil, 2
  }
  if prog == nil || len(parseDiags) > 0 {
    // The project does not parse right now. Rules never ran, so there is no
    // corpus — but these are tsgo's diagnostics to own, and failing here would
    // make an editor treat a syntax error mid-typing as a broken plugin. A nil
    // Program without diagnostics reaches the same answer rather than a JSON
    // null, which a caller decoding an array would read as a broken plugin too.
    return []publicrule.Hint{}, 0
  }
  return collectProjectHints(prog.runProjectCycle(engine)), 0
}

// hasHintPublisher reports whether any declared project rule can publish a
// corpus, and whether serving those rules needs a type checker.
//
// Both answers come from the registration table and the resolved config, so
// they are available before a Program exists — which is the point. A rule that
// the config never declared, or turned off, cannot contribute to the corpus,
// and collectProjectHints would skip it after the Program was built anyway.
//
// The checker answer is deliberately narrower than Engine.NeedsTypeChecker.
// That flag is engine-wide, so one type-aware *file* rule would make this verb
// build a checker no corpus reads. Here a checker is requested only when a rule
// that actually publishes hints declined to say it needs none — the same
// conservative default projectRuleNeedsTypeChecker applies everywhere else.
func (e *Engine) hasHintPublisher() (publishes bool, needsChecker bool) {
  if e == nil {
    return false, false
  }
  for _, name := range allProjectRuleNames() {
    setting := e.projectSettings[name]
    if !setting.Declared || setting.Severity == SeverityOff {
      continue
    }
    adapter, registered := registeredProjectRules[name]
    if !registered {
      continue
    }
    if _, publisher := adapter.inner.(publicrule.HintRule); !publisher {
      continue
    }
    publishes = true
    if projectRuleNeedsTypeChecker(name) {
      // Every publisher's need is folded in rather than returning early: one
      // rule declining a checker does not spare a sibling that reads one.
      needsChecker = true
    }
  }
  return publishes, needsChecker
}

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
