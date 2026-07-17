package linthost

import (
  "encoding/json"
  "fmt"
  "sort"
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type projectCycleResults struct {
  byName map[string]projectCycleResult
}

type projectCycleResult struct {
  status   publicrule.ProjectRuleStatus
  severity Severity
  reporter *projectReporter
  // identity and options are the configuration this rule ran under, retained so
  // a later consumer of its state — a hint corpus, say — can be handed the same
  // context Check saw without the rule stashing a copy inside its own state.
  identity publicrule.ProjectIdentity
  options  json.RawMessage
}

func (r *projectCycleResults) ProjectResult(name string) publicrule.ProjectRuleResult {
  if r == nil {
    return publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleAbsent}
  }
  result, ok := r.byName[name]
  if !ok {
    return publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleAbsent}
  }
  if result.reporter == nil {
    return publicrule.ProjectRuleResult{Status: result.status}
  }
  return result.reporter.snapshot()
}

type projectCycle struct {
  finalizeOnce sync.Once
  findings     []*Finding
  results      *projectCycleResults
}

type projectReporter struct {
  mu       sync.Mutex
  active   bool
  failed   bool
  messages map[string]struct{}
  state    any
}

func (r *projectReporter) Fail() {
  if r == nil {
    return
  }
  r.mu.Lock()
  defer r.mu.Unlock()
  if r.active {
    r.failed = true
  }
}

func (r *projectReporter) Report(message string) {
  if r == nil {
    return
  }
  r.mu.Lock()
  defer r.mu.Unlock()
  if !r.active {
    return
  }
  r.failed = true
  if r.messages == nil {
    r.messages = map[string]struct{}{}
  }
  r.messages[message] = struct{}{}
}

func (r *projectReporter) SetState(state any) {
  if r == nil {
    return
  }
  r.mu.Lock()
  defer r.mu.Unlock()
  if r.active {
    r.state = state
  }
}

func (r *projectReporter) snapshot() publicrule.ProjectRuleResult {
  return r.snapshotLocked(false)
}

func (r *projectReporter) snapshotAndClose() publicrule.ProjectRuleResult {
  return r.snapshotLocked(true)
}

func (r *projectReporter) snapshotLocked(close bool) publicrule.ProjectRuleResult {
  if r == nil {
    return publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleAbsent}
  }
  r.mu.Lock()
  defer r.mu.Unlock()
  if close {
    r.active = false
  }
  messages := make([]string, 0, len(r.messages))
  for message := range r.messages {
    messages = append(messages, message)
  }
  sort.Strings(messages)
  status := publicrule.ProjectRulePassed
  if r.failed {
    status = publicrule.ProjectRuleFailed
  }
  findings := make([]publicrule.ProjectFinding, 0, len(messages))
  for _, message := range messages {
    findings = append(findings, publicrule.ProjectFinding{Message: message})
  }
  return publicrule.NewProjectRuleResult(status, r.state, findings, r)
}

func (c *projectCycle) finalize() []*Finding {
  if c == nil || c.results == nil {
    return nil
  }
  c.finalizeOnce.Do(func() {
    names := make([]string, 0, len(c.results.byName))
    for name := range c.results.byName {
      names = append(names, name)
    }
    sort.Strings(names)
    for _, name := range names {
      entry := c.results.byName[name]
      if entry.reporter == nil {
        continue
      }
      result := entry.reporter.snapshotAndClose()
      for _, finding := range result.Findings {
        c.findings = append(c.findings, &Finding{
          Rule:     name,
          Severity: entry.severity,
          Message:  finding.Message,
        })
      }
    }
  })
  return append([]*Finding(nil), c.findings...)
}

func (e *Engine) evaluateProject(
  identity publicrule.ProjectIdentity,
  files []*shimast.SourceFile,
  checker *shimchecker.Checker,
) *projectCycle {
  results := &projectCycleResults{byName: map[string]projectCycleResult{}}
  cycle := &projectCycle{results: results}
  names := allProjectRuleNames()
  if len(names) == 0 {
    return cycle
  }
  var sources []*shimast.SourceFile
  sourcesResolved := false
  for _, name := range names {
    setting := e.projectSettings[name]
    if !setting.Declared {
      results.byName[name] = projectCycleResult{status: publicrule.ProjectRuleNotEvaluated}
      continue
    }
    if setting.Severity == SeverityOff {
      results.byName[name] = projectCycleResult{status: publicrule.ProjectRuleOff}
      continue
    }
    adapter, exists := registeredProjectRules[name]
    if !exists {
      continue
    }
    if !sourcesResolved {
      sources = e.projectSources(files)
      sourcesResolved = true
    }
    reporter := &projectReporter{active: true}
    context := publicrule.NewProjectContext(
      identity,
      sources,
      checker,
      publicrule.Severity(setting.Severity),
      setting.Options,
      reporter,
    )
    runProjectRuleCheck(adapter, context, reporter)
    results.byName[name] = projectCycleResult{
      severity: setting.Severity,
      reporter: reporter,
      identity: identity,
      options:  setting.Options,
    }
  }
  return cycle
}

// projectSources applies only project-wide ignores to the source set exposed
// to project rules. File-scoped ignores merely refine their containing entry,
// while ResolveRules marks a source Ignored only for a global ignore entry.
func (e *Engine) projectSources(files []*shimast.SourceFile) []*shimast.SourceFile {
  sources := make([]*shimast.SourceFile, 0, len(files))
  for _, file := range files {
    if file == nil {
      continue
    }
    if e != nil && e.config != nil && e.config.ResolveRules(file.FileName()).Ignored {
      continue
    }
    sources = append(sources, file)
  }
  return sources
}

func runProjectRuleCheck(
  adapter projectRuleAdapter,
  context *publicrule.ProjectContext,
  reporter *projectReporter,
) {
  defer func() {
    if recovered := recover(); recovered != nil {
      reporter.Report(fmt.Sprintf(
        "Project rule %q panicked while checking this Program: %v. Report this to the rule's author.",
        adapter.name,
        recovered,
      ))
    }
  }()
  adapter.inner.Check(context)
}
