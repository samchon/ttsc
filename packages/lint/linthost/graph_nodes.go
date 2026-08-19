package linthost

import (
  "fmt"
  "os"
  "slices"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// RunGraphNodes prints the artifacts every project rule materialized for this
// project, as JSON.
//
// Like the hints verb this takes no `--uri`: a set of artifacts describes the
// Program, not a document. It loads a Program only when the resolved config
// declares a rule that can publish one, and a caller is expected to cache the
// answer and ask again only when the project's inputs changed.
//
// An empty set is a successful answer. A project with no publishing rule is the
// common case, and a caller must be able to tell it apart from a failure; a
// nonzero exit here would read as "the project is broken".
func RunGraphNodes(args []string) int {
  opts, ok := parseLSPCommandOptions("graph-nodes", args)
  if !ok {
    return 2
  }
  nodes, code := computeGraphNodes(opts)
  if code != 0 {
    return code
  }
  return writeJSON(nodes)
}

// computeGraphNodes builds the artifact set for one project. Split from
// RunGraphNodes so a resident loop can reuse it over a warm Program, the same
// split computeLSPHints takes.
func computeGraphNodes(opts *lspCommandOptions) ([]publicrule.GraphNode, int) {
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
  publishes, needsChecker := engine.hasGraphPublisher()
  if !publishes {
    // Nothing the config declared can publish artifacts, so there is no
    // projection to take and the Program is never built. This is what keeps a
    // project that does not use the convention paying nothing for the verb.
    return []publicrule.GraphNode{}, 0
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
    // The project does not parse right now. Rules never ran, so there are no
    // artifacts — but these are tsgo's diagnostics to own, and failing here
    // would make a consumer treat a syntax error mid-typing as a broken plugin.
    return []publicrule.GraphNode{}, 0
  }
  return collectProjectGraphNodes(prog.runProjectCycle(engine)), 0
}

// hasGraphPublisher reports whether any declared project rule can publish
// artifacts, and whether serving those rules needs a type checker.
//
// Both answers come from the registration table and the resolved config, so
// they are available before a Program exists — which is the point, and matters
// more here than for hints: the artifacts a rule materializes come from parsing
// documents, not from the type system, so a project that publishes them should
// not pay for a checker no projection reads.
func (e *Engine) hasGraphPublisher() (publishes bool, needsChecker bool) {
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
    if _, publisher := adapter.inner.(publicrule.GraphRule); !publisher {
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

// collectProjectGraphNodes gathers the artifacts every declared project rule
// published for this Program.
//
// It runs after evaluateProject rather than inside it, because a set of
// artifacts is a projection of finished state. A rule is asked only when it
// passed and published state: a rule that failed materialized a description of
// a Program it just rejected, and indexing that would answer questions from
// facts the rule itself disowns.
func collectProjectGraphNodes(cycle *projectCycle) []publicrule.GraphNode {
  if cycle == nil || cycle.results == nil {
    return nil
  }
  nodes := []publicrule.GraphNode{}
  for _, name := range allProjectRuleNames() {
    result, exists := cycle.results.byName[name]
    if !exists || result.reporter == nil {
      continue
    }
    adapter, registered := registeredProjectRules[name]
    if !registered {
      continue
    }
    provider, ok := adapter.inner.(publicrule.GraphRule)
    if !ok {
      continue
    }
    snapshot := result.reporter.snapshot()
    if snapshot.Status != publicrule.ProjectRulePassed || snapshot.State == nil {
      continue
    }
    nodes = append(nodes, ruleGraphNodes(name, provider, result, snapshot)...)
  }
  return dropUnusableGraphNodes(nodes)
}

// ruleGraphNodes calls one rule's GraphNodes behind a recover barrier.
//
// The barrier matches the metadata-inspection contract: a contributor panicking
// while describing itself loses its contribution rather than the process.
func ruleGraphNodes(
  name string,
  provider publicrule.GraphRule,
  result projectCycleResult,
  snapshot publicrule.ProjectRuleResult,
) (nodes []publicrule.GraphNode) {
  defer func() {
    if recovered := recover(); recovered != nil {
      fmt.Fprintf(
        os.Stderr,
        "@ttsc/lint: project rule %q panicked while publishing graph nodes: %v; dropping its artifacts\n",
        name,
        recovered,
      )
      nodes = nil
    }
  }()
  return provider.GraphNodes(&publicrule.GraphContext{
    Identity: result.identity,
    State:    snapshot.State,
    Severity: publicrule.Severity(result.severity),
    Options:  result.options,
  })
}

// dropUnusableGraphNodes removes what a consumer cannot index, and repairs the
// one thing it can: a parent naming no published node.
//
// A node with no address has no identity to be cited by. A node whose kind is
// not in the published vocabulary is one the consumer cannot rank or contain,
// and guessing would be worse than dropping. A duplicate address is kept once,
// first writer winning, because two nodes under one address make a citation
// ambiguous — the rule's own aliases are how one artifact answers to two names.
//
// A parent that survives none of that is cleared rather than dropping its child:
// the child is still a real artifact and still citable, it simply sits at the
// top of its chain. Fabricating the missing parent is what must not happen.
func dropUnusableGraphNodes(nodes []publicrule.GraphNode) []publicrule.GraphNode {
  kinds := publicrule.GraphNodeKinds()
  seen := make(map[string]struct{}, len(nodes))
  kept := make([]publicrule.GraphNode, 0, len(nodes))
  for _, node := range nodes {
    if node.Address == "" || !slices.Contains(kinds, node.Kind) {
      continue
    }
    if _, exists := seen[node.Address]; exists {
      continue
    }
    seen[node.Address] = struct{}{}
    kept = append(kept, node)
  }
  for index := range kept {
    if kept[index].Parent == "" {
      continue
    }
    if _, exists := seen[kept[index].Parent]; !exists {
      kept[index].Parent = ""
    }
  }
  return kept
}
