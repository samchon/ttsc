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

// ProjectRuleResult is one snapshot of a named project rule in the current
// Program cycle. State is the contributor-owned value attached during the
// project check; the host neither interprets nor synchronizes its contents.
// Findings is returned as a defensive copy by host result readers.
//
// Evaluated results retain a cycle-scoped failure channel through file-rule
// dispatch. Call Report or Fail immediately before a guarded operation, then
// call Context.ProjectResult again when the updated status is needed. Absent,
// off, and not-evaluated results have no state or live failure channel.
type ProjectRuleResult struct {
  Status   ProjectRuleStatus
  State    any
  Findings []ProjectFinding

  reporter ProjectReporter
}

// NewProjectRuleResult constructs one host-owned project-result snapshot.
// Contributor code normally receives this value from Context.ProjectResult
// and does not construct it.
func NewProjectRuleResult(
  status ProjectRuleStatus,
  state any,
  findings []ProjectFinding,
  reporter ProjectReporter,
) ProjectRuleResult {
  return ProjectRuleResult{
    Status:   status,
    State:    state,
    Findings: append([]ProjectFinding(nil), findings...),
    reporter: reporter,
  }
}

// Fail marks this evaluated project result failed without adding a finding.
// It is a no-op after file dispatch or for a result that was not evaluated.
func (r ProjectRuleResult) Fail() {
  if r.reporter != nil {
    r.reporter.Fail()
  }
}

// Report records one project finding and marks this evaluated result failed.
// Equal messages are deduplicated by the host. It is a no-op after file
// dispatch or for a result that was not evaluated.
func (r ProjectRuleResult) Report(message string) {
  if r.reporter != nil {
    r.reporter.Report(message)
  }
}

// ProjectResultReader supplies live project state to later file-rule contexts.
// Hosts return ProjectRuleAbsent for names with no registered project rule.
type ProjectResultReader interface {
  ProjectResult(name string) ProjectRuleResult
}

// ProjectRule is a contributor check that runs once for a loaded Program
// before any node rule dispatch. It has no AST visit list or synthetic file.
type ProjectRule interface {
  Name() string
  Check(ctx *ProjectContext)
}

// ProjectInputKind distinguishes one exact local path from a glob population.
// Both kinds are resolved against ProjectIdentity.PhysicalProjectRoot by the
// host. Remote URLs are not project inputs.
type ProjectInputKind string

const (
  ProjectInputFile ProjectInputKind = "file"
  ProjectInputGlob ProjectInputKind = "glob"
)

// ProjectInput declares one local filesystem dependency of a ProjectRule.
// Pattern may be absolute or relative to the physical project root. Glob
// patterns support path-segment `*`, `?`, and `**`; exact files remain
// dependencies while missing.
type ProjectInput struct {
  Kind    ProjectInputKind `json:"kind"`
  Pattern string           `json:"pattern"`
}

// ProjectInputRule is the optional dependency-publication contract for a
// ProjectRule. The host calls ProjectInputs after resolving the rule's options
// and physical project identity, without loading a TypeScript Program.
type ProjectInputRule interface {
  ProjectInputs(ctx *ProjectInputContext) []ProjectInput
}

// ProjectInputContext contains the immutable configuration available while a
// ProjectRule declares its local filesystem dependencies.
type ProjectInputContext struct {
  Identity ProjectIdentity
  Severity Severity
  Options  json.RawMessage
}

// NewProjectInputContext constructs the context passed to
// ProjectInputRule.ProjectInputs. Contributor code normally receives this value
// and does not construct it.
func NewProjectInputContext(
  identity ProjectIdentity,
  severity Severity,
  options json.RawMessage,
) *ProjectInputContext {
  return &ProjectInputContext{
    Identity: identity,
    Severity: severity,
    Options:  append(json.RawMessage(nil), options...),
  }
}

// DecodeOptions unmarshals the configured project-rule options into out. A
// missing options tuple leaves out unchanged and returns nil.
func (c *ProjectInputContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
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

  reporter    ProjectReporter
  stateSetter projectStateSetter
}

type projectStateSetter interface {
  SetState(state any)
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
  stateSetter, _ := reporter.(projectStateSetter)
  return &ProjectContext{
    Identity:    identity,
    Sources:     copiedSources,
    Checker:     checker,
    Severity:    severity,
    Options:     append(json.RawMessage(nil), options...),
    reporter:    reporter,
    stateSetter: stateSetter,
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

// SetState attaches one contributor-owned value to this rule's evaluated
// result. The exact value is returned to file rules in the same Program cycle;
// contributors own any synchronization needed inside it. The host does not
// serialize the value or retain it for a later watch or LSP rebuild.
func (c *ProjectContext) SetState(state any) {
  if c == nil || c.stateSetter == nil || c.Severity == SeverityOff {
    return
  }
  c.stateSetter.SetState(state)
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
