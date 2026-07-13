package linthost

import (
  "fmt"
  "sort"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type projectCycleResults struct {
  byName map[string]publicrule.ProjectRuleResult
}

func (r *projectCycleResults) ProjectResult(name string) publicrule.ProjectRuleResult {
  if r == nil {
    return publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleAbsent}
  }
  result, ok := r.byName[name]
  if !ok {
    return publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleAbsent}
  }
  result.Findings = append([]publicrule.ProjectFinding(nil), result.Findings...)
  return result
}

type projectCycle struct {
  findings []*Finding
  results  *projectCycleResults
}

type projectReporter struct {
  failed   bool
  messages map[string]struct{}
}

func (r *projectReporter) Fail() {
  if r != nil {
    r.failed = true
  }
}

func (r *projectReporter) Report(message string) {
  if r == nil {
    return
  }
  r.failed = true
  if r.messages == nil {
    r.messages = map[string]struct{}{}
  }
  r.messages[message] = struct{}{}
}

func (e *Engine) evaluateProject(
  identity publicrule.ProjectIdentity,
  files []*shimast.SourceFile,
  checker *shimchecker.Checker,
) projectCycle {
  results := &projectCycleResults{byName: map[string]publicrule.ProjectRuleResult{}}
  cycle := projectCycle{results: results}
  names := allProjectRuleNames()
  if len(names) == 0 {
    return cycle
  }
  var sources []*shimast.SourceFile
  sourcesResolved := false
  for _, name := range names {
    setting := e.projectSettings[name]
    if !setting.Declared {
      results.byName[name] = publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleNotEvaluated}
      continue
    }
    if setting.Severity == SeverityOff {
      results.byName[name] = publicrule.ProjectRuleResult{Status: publicrule.ProjectRuleOff}
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
    reporter := &projectReporter{}
    context := publicrule.NewProjectContext(
      identity,
      sources,
      checker,
      publicrule.Severity(setting.Severity),
      setting.Options,
      reporter,
    )
    runProjectRuleCheck(adapter, context, reporter)
    messages := make([]string, 0, len(reporter.messages))
    for message := range reporter.messages {
      messages = append(messages, message)
    }
    sort.Strings(messages)
    status := publicrule.ProjectRulePassed
    if reporter.failed {
      status = publicrule.ProjectRuleFailed
    }
    result := publicrule.ProjectRuleResult{Status: status}
    for _, message := range messages {
      result.Findings = append(result.Findings, publicrule.ProjectFinding{Message: message})
      cycle.findings = append(cycle.findings, &Finding{
        Rule:     name,
        Severity: setting.Severity,
        Message:  message,
      })
    }
    results.byName[name] = result
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
