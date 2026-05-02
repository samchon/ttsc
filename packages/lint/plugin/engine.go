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
package main

import (
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

// Context is the per-(file, rule) handle the engine passes to `Check`.
type Context struct {
  File     *shimast.SourceFile
  Checker  *shimchecker.Checker
  Severity Severity

  rule    Rule
  collect func(*Finding)
}

// Finding is one rule-emitted diagnostic before it gets converted into a
// driver Diagnostic.
type Finding struct {
  Rule     string
  Severity Severity
  File     *shimast.SourceFile
  Pos      int
  End      int
  Message  string
}

// Report records a finding at the given node's source range. The pos is
// trimmed past leading trivia (whitespace + comments) so the renderer's
// `path:line:col` banner points at the offending token, not the start of
// the surrounding indentation. A finding is silently dropped if the
// configured severity is `off` (defensive — the engine already filters
// by severity before calling Check, but Report is the final gate).
func (c *Context) Report(node *shimast.Node, message string) {
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
  })
}

// ReportRange records a finding at an explicit byte range inside the
// current file. Use this when the rule wants to highlight a sub-token of
// a node (e.g. an operator inside a BinaryExpression).
func (c *Context) ReportRange(pos, end int, message string) {
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
  })
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
  config  RuleConfig
  rules   map[shimast.Kind][]Rule
  enabled map[string]Severity
  unknown []string
}

// NewEngine returns an engine configured for `config`. Rules whose
// severity is `off` are skipped entirely. Configuration entries that name
// an unknown rule are recorded so the caller can surface them as a
// configuration warning rather than a silent typo.
func NewEngine(config RuleConfig) *Engine {
  eng := &Engine{
    config:  config,
    rules:   make(map[shimast.Kind][]Rule),
    enabled: make(map[string]Severity),
  }
  for name, sev := range config {
    rule, ok := registered.rules[name]
    if !ok {
      eng.unknown = append(eng.unknown, name)
      continue
    }
    if sev == SeverityOff {
      continue
    }
    eng.enabled[name] = sev
    for _, kind := range rule.Visits() {
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

  var walk func(node *shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if rules, ok := e.rules[node.Kind]; ok {
      for _, rule := range rules {
        ctx := &Context{
          File:     file,
          Checker:  checker,
          Severity: e.enabled[rule.Name()],
          rule:     rule,
          collect:  collect,
        }
        rule.Check(ctx, node)
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
      ctx := &Context{
        File:     file,
        Checker:  checker,
        Severity: e.enabled[rule.Name()],
        rule:     rule,
        collect:  collect,
      }
      rule.Check(ctx, file.AsNode())
    }
  }

  statements := file.Statements
  if statements == nil {
    return collected
  }
  for _, stmt := range statements.Nodes {
    walk(stmt)
  }
  return collected
}
