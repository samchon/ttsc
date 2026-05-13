// Package rule is the public API for `@ttsc/lint` rule contributors.
//
// Third-party lint rule packages ("contributors") import this package and
// register their rules in an `init()`. At build time, ttsc copies a
// contributor's Go source into a sub-package of the `@ttsc/lint` Go module
// and synthesizes a blank-import in the host binary, which triggers the
// contributor's `init()` and populates the registry below.
//
// The host (`@ttsc/lint`) walks this registry during engine bootstrap and
// adapts each contributor rule onto the same dispatch table that drives
// the built-in rules.
//
// Contributors operate on the same shim AST the host's first-party
// plugins use (`github.com/microsoft/typescript-go/shim/ast` and friends)
// — there is no facade layer in between. The shim packages are the
// publicly maintained boundary ttsc already exposes; adding another
// wrapper here would duplicate that maintenance burden without earning
// any extra stability. Contributors get the full AST surface the host
// has, so authoring a contributor rule and authoring a built-in rule are
// the same exercise.
//
// Example contributor:
//
//  package myrules
//
//  import (
//      shimast "github.com/microsoft/typescript-go/shim/ast"
//      "github.com/samchon/ttsc/packages/lint/rule"
//  )
//
//  func init() { rule.Register(noTodoComment{}) }
//
//  type noTodoComment struct{}
//
//  func (noTodoComment) Name() string             { return "demo/no-todo-comment" }
//  func (noTodoComment) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindSourceFile} }
//  func (noTodoComment) Check(ctx *rule.Context, node *shimast.Node) {
//      // ctx.File, ctx.Checker, ctx.Severity available; ctx.Report(node, msg)
//      // or ctx.ReportRange(pos, end, msg) push a finding through the engine.
//  }
package rule

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Severity mirrors the engine's three-level severity ladder. The
// constants are kept value-compatible with the engine's internal
// `Severity` type so the adapter layer can cast safely.
type Severity int

const (
  // SeverityOff means the rule is disabled. Engine skips dispatch.
  SeverityOff Severity = iota
  // SeverityWarn produces a warning diagnostic (does not change exit
  // code).
  SeverityWarn
  // SeverityError produces an error diagnostic and fails the command.
  SeverityError
)

// Rule is the contract every contributor rule satisfies. Mirrors the
// internal host interface so the host can dispatch via a thin adapter
// without re-implementing the engine.
type Rule interface {
  // Name is the identifier users put in their `rules` map.
  // Conventionally namespaced as "<plugin-namespace>/<rule-name>" to
  // avoid colliding with built-in rule names.
  Name() string

  // Visits returns the AST kinds the rule cares about. The engine only
  // dispatches to rules that registered for the visited node's kind.
  Visits() []shimast.Kind

  // Check is invoked once per relevant node. Use `ctx.Report` /
  // `ctx.ReportRange` to emit findings.
  Check(ctx *Context, node *shimast.Node)
}

// Reporter is the engine-supplied callback that records a finding. The
// host implements this and passes it to `NewContext` when invoking a
// contributor rule.
type Reporter interface {
  // Report records a finding at the given node's source range.
  Report(node *shimast.Node, message string)
  // ReportRange records a finding at an explicit byte range inside the
  // current file. Use this when the rule wants to highlight a
  // sub-token.
  ReportRange(pos, end int, message string)
}

// Context is the per-(file, rule) handle the engine passes to `Check`.
// The `Reporter` is supplied by the host when constructing the context;
// contributors call `ctx.Report` / `ctx.ReportRange` directly through
// this Context rather than touching the reporter.
type Context struct {
  // File is the source file currently being walked. Always non-nil
  // when `Check` is invoked.
  File *shimast.SourceFile

  // Checker is the host's tsgo type checker. Available for type-aware
  // rules; nil-safe enough that AST-only rules can ignore it.
  Checker *shimchecker.Checker

  // Severity is the rule's resolved severity for this file. Already
  // filtered by the engine — rules do not need to check for
  // SeverityOff.
  Severity Severity

  reporter Reporter
}

// NewContext constructs a Context for the engine to pass into a
// contributor rule's `Check`. Reserved for host code; contributors
// should not need to call this.
func NewContext(
  file *shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  reporter Reporter,
) *Context {
  return &Context{
    File:     file,
    Checker:  checker,
    Severity: severity,
    reporter: reporter,
  }
}

// Report records a finding at the given node's source range. Silently
// ignored when severity is `off` (defensive — the engine already filters
// by severity before invoking Check) or when no reporter is attached.
func (c *Context) Report(node *shimast.Node, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  c.reporter.Report(node, message)
}

// ReportRange records a finding at an explicit byte range inside the
// current file.
func (c *Context) ReportRange(pos, end int, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.ReportRange(pos, end, message)
}

var registry []Rule

// Register adds a contributor rule to the global registry. Called from a
// contributor package's `init()`. Duplicate names are NOT checked here
// — the host's adapter layer surfaces collisions with a clearer error
// than a raw panic.
func Register(r Rule) {
  if r == nil {
    panic("rule: Register called with nil rule")
  }
  registry = append(registry, r)
}

// Registered returns every contributor rule registered via `Register`.
// Called once by the host during engine bootstrap. The returned slice is
// a defensive copy so the host cannot mutate the registry.
func Registered() []Rule {
  out := make([]Rule, len(registry))
  copy(out, registry)
  return out
}
