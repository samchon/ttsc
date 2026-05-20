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
// Contributors operate on the same shim AST the host and linked transform
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
  "encoding/json"

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

// FormatRule is an optional marker contributors implement when a rule
// belongs to the "format" category instead of the default "lint"
// category. `ttsc fix` is the run-everything entry point and applies
// edits from BOTH lint-class and format-class rules. `ttsc format` is
// the format-only convenience: it filters to FormatRule findings so
// lint-class rewrites are skipped. Lint rules (rules that do not
// implement FormatRule) participate only in `ttsc fix` (and in
// diagnostics during `ttsc check`).
//
// `IsFormat` exists as a structural marker, not a runtime toggle:
// returning `false` is equivalent to not implementing the interface at
// all, and the host treats either form the same way.
type FormatRule interface {
  Rule
  IsFormat() bool
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

// FixReporter is the optional extension a host implements to receive
// autofix edits alongside a finding. The public `rule.Context` type-asserts
// against this shape so any host whose reporter exposes both methods opts
// into fix support without depending on a private interface name.
//
// Contributor rules do NOT implement this interface — it is the host-side
// counterpart to `Context.ReportFix` / `Context.ReportRangeFix`. A
// contributor authoring a fake reporter for unit tests can declare
// `var _ rule.FixReporter = &myReporter{}` to compile-check that the fake
// satisfies the fix surface. Go interface satisfaction is all-or-nothing:
// a fake that wants the fix path must implement BOTH `ReportFix` and
// `ReportRangeFix`.
type FixReporter interface {
  ReportFix(node *shimast.Node, message string, edits ...TextEdit)
  ReportRangeFix(pos, end int, message string, edits ...TextEdit)
}

// TextEdit is one byte-range replacement offered by an autofixable finding.
// Positions use the same byte offsets as shim AST nodes and must point inside
// the current source file. An empty `Text` deletes the range; positions are
// in lexer byte order, not visual order, so a UTF-8 multi-byte sequence must
// be replaced as a whole.
//
// Application policy: a rule may emit several `TextEdit`s in one
// `ReportFix` / `ReportRangeFix` call, in any order. The host treats the
// per-pass edit set as a candidate list. Within a single fix pass, edits
// must not overlap each other; when two edits cover overlapping ranges
// (either from one rule emitting multiple edits in one call, or from two
// different rules in the same pass), the host applies the earliest-starting
// / shortest edit and silently drops the rest. There is no diagnostic for
// dropped edits, and the host does not currently report when a comment
// falls inside a deletion range. Design fixes so each finding emits one
// contiguous TextEdit covering the entire replacement region.
type TextEdit struct {
  Pos  int
  End  int
  Text string
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

  // Options is the raw JSON blob the user wrote in the second slot of
  // their `[severity, options]` rule configuration tuple. Nil when the
  // rule was configured with a bare severity literal. Contributors that
  // accept options decode the blob into their own struct via
  // `(*Context).DecodeOptions`.
  Options json.RawMessage

  reporter Reporter
}

// NewContext constructs a Context for the engine to pass into a
// contributor rule's `Check`. Reserved for host code; contributors
// should not need to call this.
func NewContext(
  file *shimast.SourceFile,
  checker *shimchecker.Checker,
  severity Severity,
  options json.RawMessage,
  reporter Reporter,
) *Context {
  return &Context{
    File:     file,
    Checker:  checker,
    Severity: severity,
    Options:  options,
    reporter: reporter,
  }
}

// DecodeOptions unmarshals the rule's options blob into `out`. Returns
// nil with no side effect when the rule was configured with severity
// alone, so contributors can write:
//
//  var opts myRuleOptions
//  _ = ctx.DecodeOptions(&opts)
//  // opts now holds either the user's settings or the zero value.
func (c *Context) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
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

// ReportFix records a finding at the given node's source range with optional
// autofix edits. Older hosts that do not implement fix reporting receive the
// diagnostic without edits.
// Treat edits as best-effort: design the rule so the diagnostic alone is useful.
func (c *Context) ReportFix(node *shimast.Node, message string, edits ...TextEdit) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff || node == nil {
    return
  }
  if len(edits) == 0 {
    c.reporter.Report(node, message)
    return
  }
  fixer, ok := c.reporter.(FixReporter)
  if !ok {
    c.reporter.Report(node, message)
    return
  }
  fixer.ReportFix(node, message, edits...)
}

// ReportRange records a finding at an explicit byte range inside the
// current file.
func (c *Context) ReportRange(pos, end int, message string) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  c.reporter.ReportRange(pos, end, message)
}

// ReportRangeFix records a finding at an explicit byte range with optional
// autofix edits. Older hosts that do not implement fix reporting receive the
// diagnostic without edits.
// Treat edits as best-effort: design the rule so the diagnostic alone is useful.
func (c *Context) ReportRangeFix(pos, end int, message string, edits ...TextEdit) {
  if c == nil || c.reporter == nil || c.Severity == SeverityOff {
    return
  }
  if len(edits) == 0 {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  fixer, ok := c.reporter.(FixReporter)
  if !ok {
    c.reporter.ReportRange(pos, end, message)
    return
  }
  fixer.ReportRangeFix(pos, end, message, edits...)
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
