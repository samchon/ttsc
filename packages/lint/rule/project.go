package rule

import (
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// ProjectIdentity names one loaded TypeScript Program without conflating the
// caller's path spelling with the filesystem identity used by the compiler.
// Empty explicit fields mean the caller did not provide that channel.
type ProjectIdentity struct {
  LifecycleID         string `json:"lifecycleId"`
  InvocationCwd       string `json:"invocationCwd"`
  LogicalConfigPath   string `json:"logicalConfigPath"`
  LogicalProjectRoot  string `json:"logicalProjectRoot"`
  PhysicalConfigPath  string `json:"physicalConfigPath"`
  PhysicalProjectRoot string `json:"physicalProjectRoot"`
  ExplicitProjectRoot string `json:"explicitProjectRoot,omitempty"`
  PluginConfigOrigin  string `json:"pluginConfigOrigin,omitempty"`
}

// ProjectRuleStatus describes whether a named project rule exists, was
// configured, and completed during the current Program cycle.
type ProjectRuleStatus string

const (
  ProjectRuleAbsent       ProjectRuleStatus = "absent"
  ProjectRuleOff          ProjectRuleStatus = "off"
  ProjectRuleNotEvaluated ProjectRuleStatus = "not_evaluated"
  ProjectRulePassed       ProjectRuleStatus = "passed"
  ProjectRuleFailed       ProjectRuleStatus = "failed"
)

// ProjectFinding is a non-file finding retained in a project rule's cycle
// result. Project findings never contain edits or source ranges.
type ProjectFinding struct {
  Message string
}

// ProjectRuleResult is the finalized, read-only view of one named project
// rule. Findings is returned as a defensive copy by host result readers.
type ProjectRuleResult struct {
  Status   ProjectRuleStatus
  Findings []ProjectFinding
}

// ProjectResultReader supplies finalized project state to later file-rule
// contexts. Hosts return ProjectRuleAbsent for names with no registered
// project rule.
type ProjectResultReader interface {
  ProjectResult(name string) ProjectRuleResult
}

// ProjectRule is a contributor check that runs once for a loaded Program
// before any node rule dispatch. It has no AST visit list or synthetic file.
type ProjectRule interface {
  Name() string
  Check(ctx *ProjectContext)
}

// ProjectReporter is the cycle-scoped failure channel available to project
// helpers. Report records a deterministic project finding and also marks the
// current rule failed; Fail marks failure without adding a finding.
type ProjectReporter interface {
  Fail()
  Report(message string)
}

// ProjectContext contains the immutable inputs for one project-rule check.
// Sources is a defensive copy of the Program's tsconfig-selected user sources.
type ProjectContext struct {
  Identity ProjectIdentity
  Sources  []*shimast.SourceFile
  Checker  *shimchecker.Checker
  Severity Severity
  Options  json.RawMessage

  reporter ProjectReporter
}

// NewProjectContext constructs the context a host passes to ProjectRule.Check.
// Contributor code normally receives this value and does not construct it.
func NewProjectContext(
  identity ProjectIdentity,
  sources []*shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  options json.RawMessage,
  reporter ProjectReporter,
) *ProjectContext {
  copiedSources := append([]*shimast.SourceFile(nil), sources...)
  return &ProjectContext{
    Identity: identity,
    Sources:  copiedSources,
    Checker:  checker,
    Severity: severity,
    Options:  append(json.RawMessage(nil), options...),
    reporter: reporter,
  }
}

// DecodeOptions unmarshals the configured project-rule options into out. A
// missing options tuple leaves out unchanged and returns nil.
func (c *ProjectContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// Fail marks the current project rule failed without adding a diagnostic.
func (c *ProjectContext) Fail() {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.Fail()
}

// Report records one non-file project finding and marks the rule failed.
func (c *ProjectContext) Report(message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.Report(message)
}

var projectRegistry []ProjectRule

// RegisterProject adds a contributor project rule to the global registry.
// Hosts validate duplicate names after all contributor init functions finish.
func RegisterProject(r ProjectRule) {
  if r == nil {
    panic("rule: RegisterProject called with nil rule")
  }
  projectRegistry = append(projectRegistry, r)
}

// RegisteredProjects returns a defensive copy of all registered project rules.
func RegisteredProjects() []ProjectRule {
  out := make([]ProjectRule, len(projectRegistry))
  copy(out, projectRegistry)
  return out
}
