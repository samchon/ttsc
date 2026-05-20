// The lint plugin hosts the rule registry, the AST-walking engine, and the
// orchestration glue that the `@ttsc/lint` native plugin uses to run rules
// against a tsgo Program.
//
// Layering:
//
//   - `Rule` is the interface every rule implements. Rules are
//     registered at package init time and never mutated.
//   - `Engine` walks every user source file once, dispatching each visited
//     node to the rules that opted in via `Visits()`.
//   - `Context` is what a rule receives when it fires; it owns the
//     report channel back to the engine.
//
// Rules are stateless across files: each invocation gets a fresh `Context`
// and may not retain references to the previous file. This keeps the
// engine concurrent-friendly even though the v0 implementation runs
// serially.
package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "sort"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// Rule is the contract every lint rule satisfies.
type Rule interface {
  // Name is the identifier that users put in their `rules` map. Use
  // the same names as `eslint` / `@typescript-eslint` where possible —
  // this plugin is a host, not a renaming exercise.
  Name() string

  // Visits returns the AST kinds the rule cares about. The engine only
  // dispatches to rules that registered for the visited node's kind,
  // which keeps the per-node hot path linear in active rules rather
  // than total rules.
  Visits() []shimast.Kind

  // Check is invoked once per relevant node. Use `ctx.Report` to emit
  // findings.
  Check(ctx *Context, node *shimast.Node)
}

// FormatRule is an optional marker interface that tags a Rule as a
// formatter. `ttsc fix` is the run-everything entry point — it applies
// edits from BOTH lint-class rules and FormatRule rules. `ttsc format`
// is the format-only convenience: it filters to FormatRule findings so
// lint-class rewrites are skipped. The marker exists so the format
// filter can pick the right half; fix needs no filter.
//
// FormatRule.IsFormat must return true unconditionally — the method
// exists as a structural marker, not a runtime toggle. Returning false
// is treated by the engine as "not a format rule" and is equivalent to
// not implementing the interface at all.
type FormatRule interface {
  Rule
  IsFormat() bool
}

// isFormatRule reports whether `r` opts into the format category.
func isFormatRule(r Rule) bool {
  fr, ok := r.(FormatRule)
  return ok && fr.IsFormat()
}

// Context is the per-(file, rule) handle the engine passes to `Check`.
//
// `Options` is the raw JSON blob the user wrote in their rule
// configuration's second tuple slot (`["warning", { ... }]`). It is nil
// when the rule was configured with a bare severity literal. Rules that
// accept options decode the blob into their own struct via
// `(*Context).DecodeOptions` and fall back to defaults on nil.
type Context struct {
  File     *shimast.SourceFile
  Checker  *shimchecker.Checker
  Severity Severity
  Options  json.RawMessage

  rule     Rule
  isFormat bool
  collect  func(*Finding)
}

// DecodeOptions unmarshals the rule's options blob into `out`. Returns
// nil with no side effect when the rule was configured with severity
// alone, so callers can write
//
//  var opts myRuleOptions
//  ctx.DecodeOptions(&opts)
//  // opts now holds either the user's settings or the zero value.
func (c *Context) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// Finding is one rule-emitted diagnostic before it gets converted into a
// driver Diagnostic. `IsFormat` mirrors the dispatching rule's category
// so the `format` subcommand's filter can route findings without
// re-querying the registry. The `fix` subcommand applies findings from
// both categories — no filter — because `ttsc fix` is the
// run-everything entry point.
type Finding struct {
  Rule     string
  Severity Severity
  File     *shimast.SourceFile
  Pos      int
  End      int
  Message  string
  Fix      []TextEdit
  IsFormat bool
}

// TextEdit is one byte-range replacement offered by an autofixable finding.
// Positions use the same byte offsets as shim AST nodes and must point inside
// the finding's source file.
type TextEdit struct {
  Pos  int
  End  int
  Text string
}

// Report records a finding at the given node's source range. The pos is
// trimmed past leading trivia (whitespace + comments) so the renderer's
// `path:line:col` banner points at the offending token, not the start of
// the surrounding indentation. A finding is silently dropped if the
// configured severity is `off` (defensive — the engine already filters
// by severity before calling Check, but Report is the final gate).
func (c *Context) Report(node *shimast.Node, message string) {
  c.ReportFix(node, message)
}

// ReportFix records a node-scoped finding with optional autofix edits.
func (c *Context) ReportFix(node *shimast.Node, message string, edits ...TextEdit) {
  if c.Severity == SeverityOff || node == nil {
    return
  }
  pos := node.Pos()
  if c.File != nil {
    pos = shimscanner.SkipTrivia(c.File.Text(), pos)
  }
  c.collect(&Finding{
    Rule:     c.rule.Name(),
    Severity: c.Severity,
    File:     c.File,
    Pos:      pos,
    End:      node.End(),
    Message:  message,
    Fix:      cloneTextEdits(edits),
    IsFormat: c.isFormat,
  })
}

// ReportRange records a finding at an explicit byte range inside the
// current file. Use this when the rule wants to highlight a sub-token of
// a node (e.g. an operator inside a BinaryExpression).
func (c *Context) ReportRange(pos, end int, message string) {
  c.ReportRangeFix(pos, end, message)
}

// ReportRangeFix records an explicit-range finding with optional autofix edits.
func (c *Context) ReportRangeFix(pos, end int, message string, edits ...TextEdit) {
  if c.Severity == SeverityOff || c.File == nil {
    return
  }
  if end <= pos {
    end = pos + 1
  }
  c.collect(&Finding{
    Rule:     c.rule.Name(),
    Severity: c.Severity,
    File:     c.File,
    Pos:      pos,
    End:      end,
    Message:  message,
    Fix:      cloneTextEdits(edits),
    IsFormat: c.isFormat,
  })
}

// cloneTextEdits returns a shallow copy of `edits` so that the caller's
// variadic slice cannot be mutated through the stored Finding. Returns nil
// when the input is empty, keeping the Finding.Fix field nil rather than
// a zero-length slice.
func cloneTextEdits(edits []TextEdit) []TextEdit {
  if len(edits) == 0 {
    return nil
  }
  out := make([]TextEdit, len(edits))
  copy(out, edits)
  return out
}

// registry stores the package-global rule list keyed by name. Tests can
// also reach into it via `LookupRule`.
type registry struct {
  rules map[string]Rule
}

var registered = &registry{rules: map[string]Rule{}}

// Register adds a rule to the global registry. Called from each rule's
// `init()`. Duplicate names are a programmer error and panic.
func Register(rule Rule) {
  if rule == nil {
    panic("@ttsc/lint: Register called with nil rule")
  }
  if _, exists := registered.rules[rule.Name()]; exists {
    panic("@ttsc/lint: rule " + rule.Name() + " registered twice")
  }
  registered.rules[rule.Name()] = rule
}

// LookupRule returns the registered rule by name, or nil if missing.
func LookupRule(name string) Rule { return registered.rules[name] }

// AllRuleNames returns the registry sorted alphabetically. Useful for
// `--list-rules` style introspection and stable test snapshots.
func AllRuleNames() []string {
  names := make([]string, 0, len(registered.rules))
  for n := range registered.rules {
    names = append(names, n)
  }
  sort.Strings(names)
  return names
}

// Engine binds a rule configuration to a Program and walks the AST once
// per source file, dispatching each visited node to its interested rules.
type Engine struct {
  config  RuleResolver
  rules   map[shimast.Kind][]Rule
  enabled map[string]Severity
  unknown []string
}

// NewEngine returns an engine configured for `config`. Rules whose
// severity is `off` are skipped entirely. Configuration entries that name
// an unknown rule are recorded so the caller can surface them as a
// configuration warning rather than a silent typo.
func NewEngine(config RuleConfig) *Engine {
  return NewEngineWithResolver(config)
}

// NewEngineWithResolver returns an engine configured by a resolver that can
// vary rule severities per file.
func NewEngineWithResolver(config RuleResolver) *Engine {
  if config == nil {
    config = RuleConfig{}
  }
  eng := &Engine{
    config:  config,
    rules:   make(map[shimast.Kind][]Rule),
    enabled: make(map[string]Severity),
  }
  displaySeverities := config.EnabledRuleConfig()
  for _, name := range config.ActiveRuleNames() {
    rule, ok := registered.rules[name]
    if !ok {
      eng.unknown = append(eng.unknown, name)
      continue
    }
    eng.enabled[name] = displaySeverities.Severity(name)
    // Dedup kinds per rule so a contributor that accidentally lists the
    // same Kind twice in `Visits()` doesn't end up firing twice per node.
    seen := make(map[shimast.Kind]struct{})
    for _, kind := range rule.Visits() {
      if _, dup := seen[kind]; dup {
        continue
      }
      seen[kind] = struct{}{}
      eng.rules[kind] = append(eng.rules[kind], rule)
    }
  }
  sort.Strings(eng.unknown)
  return eng
}

// UnknownRules returns the names of rules that appeared in the config but
// have no registered implementation.
func (e *Engine) UnknownRules() []string { return e.unknown }

// EnabledRules returns the active rule set keyed by name. Mostly for
// tests + introspection.
func (e *Engine) EnabledRules() map[string]Severity { return e.enabled }

// Run walks every non-declaration source file in the program and
// returns the collected findings.
func (e *Engine) Run(files []*shimast.SourceFile, checker *shimchecker.Checker) []*Finding {
  var findings []*Finding
  for _, file := range files {
    if file == nil || file.IsDeclarationFile {
      continue
    }
    findings = append(findings, e.runFile(file, checker)...)
  }
  return findings
}

// runFile is the per-file driver. The visitor is allocated once per file
// to keep the per-node hot path branch-free; it visits children
// post-order so parents see their already-checked subtrees.
func (e *Engine) runFile(file *shimast.SourceFile, checker *shimchecker.Checker) []*Finding {
  var collected []*Finding
  collect := func(f *Finding) { collected = append(collected, f) }
  resolved := e.config.ResolveRules(file.FileName())
  if resolved.Ignored {
    return collected
  }
  fileRules := resolved.Rules

  var walk func(node *shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if rules, ok := e.rules[node.Kind]; ok {
      for _, rule := range rules {
        severity := fileRules.Severity(rule.Name())
        if severity == SeverityOff {
          continue
        }
        ctx := &Context{
          File:     file,
          Checker:  checker,
          Severity: severity,
          Options:  e.config.RuleOptions(rule.Name()),
          rule:     rule,
          isFormat: isFormatRule(rule),
          collect:  collect,
        }
        runRuleCheck(rule, ctx, node, collect)
      }
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false // visit every child
    })
  }

  // SourceFile dispatches into its statement list directly; we walk
  // statements explicitly so the file node itself can be inspected by
  // rules (e.g., `ban-ts-comment` reads CommentDirectives off the
  // SourceFile).
  if rules, ok := e.rules[shimast.KindSourceFile]; ok {
    for _, rule := range rules {
      severity := fileRules.Severity(rule.Name())
      if severity == SeverityOff {
        continue
      }
      ctx := &Context{
        File:     file,
        Checker:  checker,
        Severity: severity,
        Options:  e.config.RuleOptions(rule.Name()),
        rule:     rule,
        isFormat: isFormatRule(rule),
        collect:  collect,
      }
      runRuleCheck(rule, ctx, file.AsNode(), collect)
    }
  }

  statements := file.Statements
  if statements != nil {
    for _, stmt := range statements.Nodes {
      walk(stmt)
    }
  }
  // Apply inline-disable filtering even for files with no statement
  // list. A SourceFile-level rule that fires on a `// ttsc-lint-disable`
  // comment must still honor the directive; early-returning before
  // the filter would silently leak those findings into the diagnostic
  // stream.
  return filterInlineDisabledFindings(file, collected)
}

// runRuleCheck invokes a rule's `Check` with a `recover()` barrier so a
// panicking rule does not abort the entire `ttsc fix` / `ttsc check`
// run. Built-in rules are not expected to panic, but contributor rules
// crossing into the public `rule.Context` adapter can be authored by
// anyone; protecting the engine is the only way to bound the blast
// radius of one bad rule. The recovered panic is surfaced as a
// SeverityError finding tagged with the rule's name so the user sees
// the failure in the normal diagnostic stream.
func runRuleCheck(rule Rule, ctx *Context, node *shimast.Node, collect func(*Finding)) {
  defer func() {
    r := recover()
    if r == nil {
      return
    }
    if ctx == nil || ctx.File == nil {
      // Without source context there is nowhere to anchor the
      // diagnostic. Surface to stderr so the panic is at least
      // visible to the operator.
      fmt.Fprintf(os.Stderr, "@ttsc/lint: rule %q panicked: %v\n", rule.Name(), r)
      return
    }
    pos := 0
    end := 1
    if node != nil {
      pos = node.Pos()
      end = node.End()
    }
    if end <= pos {
      end = pos + 1
    }
    collect(&Finding{
      Rule:     rule.Name(),
      Severity: SeverityError,
      Pos:      pos,
      End:      end,
      Message: fmt.Sprintf(
        "Rule %q panicked while checking this node: %v. Report this to the rule's author; ttsc skipped the rule on this file.",
        rule.Name(), r,
      ),
      File: ctx.File,
    })
  }()
  rule.Check(ctx, node)
}
