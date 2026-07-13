// Adapter that bridges public `rule.Rule` contributors onto the engine's
// internal `Rule` interface. Built-in rules live in `package main` and
// dispatch directly through `Register`; contributors live in sibling
// packages and call `rule.Register` from their `init()`. This file walks
// the populated `rule.Registered()` slice and wraps each entry so the
// engine sees the same surface for built-in and contributor rules.
//
// Init order: every contributor package's `init` runs before `package
// main`'s init (Go spec). But the built-in rules also register from
// `package main` init functions and the relative order across files in
// the same package is alphabetical — so we cannot blindly run the
// contributor wiring from a file-level `init()` and expect built-in
// registration to have already completed. Instead, `registerContributorsOnce`
// is invoked explicitly from `run` after all built-in `init` calls have
// settled, which makes the collision check meaningful.
package linthost

import (
  "fmt"
  "os"
  "sort"
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

var contributorBootstrap sync.Once

// registerContributorsOnce installs the immutable init-time contributor
// registries exactly once. Main is a reusable library entry and may be called
// concurrently, so every caller must wait for the same completed bootstrap
// before constructing an Engine that reads the global rule maps.
func registerContributorsOnce() {
  contributorBootstrap.Do(registerContributors)
}

// registerContributors wraps every contributor rule registered through
// the public `rule` package into the engine's internal `Rule` interface
// and pushes it onto the same dispatch table the built-in rules use.
//
// Collision policy: a contributor that shares a name with an existing
// rule (built-in or another contributor whose init ran first) is dropped
// with a stderr warning. The host prefers a deterministic, debuggable
// outcome over panicking inside startup.
func registerContributors() {
  registered := rule.Registered()
  contributors := make([]contributorMetadata, 0, len(registered))
  for _, contributor := range registered {
    metadata, err := inspectContributor(contributor)
    if err != nil {
      fmt.Fprintf(os.Stderr,
        "@ttsc/lint: %v; dropping contributor entry\n",
        err)
      continue
    }
    contributors = append(contributors, metadata)
  }
  sort.SliceStable(contributors, func(i, j int) bool {
    return contributors[i].name < contributors[j].name
  })
  for _, contributor := range contributors {
    name := contributor.name
    if name == "" {
      fmt.Fprintln(os.Stderr, "@ttsc/lint: contributor rule with empty name ignored")
      continue
    }
    if LookupRule(name) != nil {
      fmt.Fprintf(os.Stderr,
        "@ttsc/lint: contributor rule %q collides with an existing rule; dropping contributor entry\n",
        name)
      continue
    }
    adapter := newContributorAdapter(contributor)
    if contributor.isFormat {
      Register(formatContributorAdapter{adapter})
      continue
    }
    Register(adapter)
  }
  registerProjectContributors()
}

// contributorMetadata is the immutable host-side view of a public contributor
// rule. Every contributor-defined metadata method is evaluated exactly once
// behind inspectContributor's recover barrier so a broken declaration cannot
// panic later during registry sorting or engine construction.
type contributorMetadata struct {
  inner                  rule.Rule
  isFormat               bool
  name                   string
  visits                 []shimast.Kind
  visitsDeclarationFiles bool
}

// inspectContributor evaluates the public rule metadata behind a recover
// barrier. Check itself is protected separately by runRuleCheck; this function
// covers the startup methods the engine must call before it can dispatch a
// node. A panicking contributor is rejected as one entry while the rest of the
// lint registry remains usable.
func inspectContributor(contributor rule.Rule) (metadata contributorMetadata, err error) {
  defer func() {
    if recovered := recover(); recovered != nil {
      err = fmt.Errorf("contributor %T metadata panicked: %v", contributor, recovered)
    }
  }()
  metadata = contributorMetadata{
    inner:                  contributor,
    name:                   contributor.Name(),
    visits:                 append([]shimast.Kind(nil), contributor.Visits()...),
    visitsDeclarationFiles: true,
  }
  if formatRule, ok := contributor.(rule.FormatRule); ok {
    metadata.isFormat = formatRule.IsFormat()
  }
  if declarationRule, ok := contributor.(rule.DeclarationFileRule); ok {
    metadata.visitsDeclarationFiles = declarationRule.VisitsDeclarationFiles()
  }
  return metadata, nil
}

// newContributorAdapter builds the engine-facing adapter from metadata already
// evaluated by inspectContributor, so no adapter method re-enters contributor
// code after startup. This is the only construction path; a zero-value
// contributorAdapter carries no usable metadata.
func newContributorAdapter(metadata contributorMetadata) contributorAdapter {
  return contributorAdapter{
    inner:                  metadata.inner,
    name:                   metadata.name,
    visits:                 metadata.visits,
    visitsDeclarationFiles: metadata.visitsDeclarationFiles,
  }
}

// contributorAdapter wraps a public `rule.Rule` so the engine's
// `Register` accepts it. Name, Visits, and declaration-file policy are
// cached by inspectContributor; Check bridges through a `rule.Context`
// whose `Reporter` calls back into the engine's existing Context.Report /
// ReportRange. The
// public `rule.Context` and the engine's internal `Context` share the
// same shim AST types, so no wrapping / unwrapping of nodes is needed.
type contributorAdapter struct {
  inner                  rule.Rule
  name                   string
  visits                 []shimast.Kind
  visitsDeclarationFiles bool
}

// NeedsTypeChecker keeps contributor rules on the historical checker path.
// The public rule.Context exposes Checker and has no mandatory marker, so the
// host cannot safely infer that a third-party rule is AST-only.
func (a contributorAdapter) NeedsTypeChecker() bool {
  return true
}

// VisitsDeclarationFiles keeps contributor rules running on declaration
// files unless the contributor opts out through the public
// `rule.DeclarationFileRule` marker. Same conservative-default reasoning
// as NeedsTypeChecker: the host cannot infer a third-party rule's grammar
// shape, and a wrong skip silently loses findings. The default-true /
// marker-override policy is applied once in inspectContributor.
func (a contributorAdapter) VisitsDeclarationFiles() bool {
  return a.visitsDeclarationFiles
}

// formatContributorAdapter is the FormatRule-tagged variant of
// contributorAdapter. Wrapping the lint-only adapter (rather than
// duplicating its method set) keeps the marker addition trivial and
// guarantees the host's `isFormatRule` check fires through the standard
// type assertion path.
type formatContributorAdapter struct {
  contributorAdapter
}

func (formatContributorAdapter) IsFormat() bool { return true }

func (a contributorAdapter) Name() string           { return a.name }
func (a contributorAdapter) Visits() []shimast.Kind { return a.visits }
func (a contributorAdapter) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil {
    return
  }
  pubCtx := rule.NewContextWithProjectResults(
    ctx.File,
    ctx.Checker,
    rule.Severity(ctx.Severity),
    ctx.Options,
    contextReporter{ctx: ctx},
    ctx.projectResults,
  )
  a.inner.Check(pubCtx, node)
}

// contextReporter forwards `rule.Reporter` calls back to the host's
// existing collect pipeline. Trivial because the public and internal
// reporter signatures both speak `*shimast.Node`.
type contextReporter struct {
  ctx *Context
}

func (r contextReporter) Report(node *shimast.Node, message string) {
  r.ctx.Report(node, message)
}

func (r contextReporter) ReportFix(node *shimast.Node, message string, edits ...rule.TextEdit) {
  r.ctx.ReportFix(node, message, toInternalTextEdits(edits)...)
}

func (r contextReporter) ReportRange(pos, end int, message string) {
  r.ctx.ReportRange(pos, end, message)
}

func (r contextReporter) ReportRangeFix(pos, end int, message string, edits ...rule.TextEdit) {
  r.ctx.ReportRangeFix(pos, end, message, toInternalTextEdits(edits)...)
}

func toInternalTextEdits(edits []rule.TextEdit) []TextEdit {
  if len(edits) == 0 {
    return nil
  }
  out := make([]TextEdit, len(edits))
  for i, edit := range edits {
    out[i] = TextEdit{
      Pos:  edit.Pos,
      End:  edit.End,
      Text: edit.Text,
    }
  }
  return out
}
