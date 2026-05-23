package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "sort"
)

// maxFormatPasses bounds the format cascade for the same reason
// `maxFixPasses` does in fix.go: a rule that re-reports its own edit
// could otherwise loop forever. Format rules touch surface details
// (quotes, semicolons, trailing commas, import order) so a real-world
// cascade settles in a handful of passes; the cap is the safety net,
// not the expected steady state.
const maxFormatPasses = 10

// RunFormat implements `@ttsc/lint format` — apply format-rule edits
// only. Write-only by contract: no diagnostic output, no typecheck
// recheck. Mirrors RunFix in flag handling so the host launcher can
// forward the same option shape.
func RunFormat(args []string) int {
  opts, err := parseSubcommandFlags("format", args)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if opts.emit {
    fmt.Fprintln(os.Stderr, "@ttsc/lint format: --emit is not supported")
    return 2
  }
  opts.noEmit = true
  return runFormat(opts)
}

// runFormat is the internal implementation of RunFormat. It drives the
// cascade loop and applies format-rule edits until convergence.
func runFormat(opts *subcommandOpts) int {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  resolver := formatCommandResolver{inner: rules}
  engine := NewEngineWithResolver(resolver)
  engine.SetSerial(opts.singleThreaded)
  needsRuleChecker := engine.NeedsTypeChecker()

  prog, code := loadFixProgram(opts, needsRuleChecker)
  if code != 0 {
    return code
  }
  defer func() {
    if prog != nil {
      prog.close()
    }
  }()

  totalFixes := 0
  cascadeConverged := false
  for pass := 0; pass < maxFormatPasses; pass++ {
    findings := engine.Run(prog.userSourceFiles(), prog.checker)
    fixed, err := applyFindingFixes(opts.cwd, filterFormatFindings(findings))
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 3
    }
    if fixed == 0 {
      cascadeConverged = true
      break
    }
    totalFixes += fixed
    prog, code = reloadFixProgram(prog, opts, needsRuleChecker)
    if code != 0 {
      return code
    }
  }
  if !cascadeConverged {
    // Format runs are write-only by contract, so a non-converged exit
    // leaves the user's files in a partially-formatted state with no
    // diagnostic surface to expose the cause. Emit an explicit signal
    // and a non-zero exit code so a CI gate like
    // `ttsc format && echo done` does not silently accept the
    // non-idempotent state.
    fmt.Fprintf(os.Stderr,
      "@ttsc/lint: format cascade did not converge after %d passes; rerun or check for a non-idempotent format rule\n",
      maxFormatPasses)
    return 2
  }

  if opts.verbose && totalFixes > 0 {
    fmt.Fprintf(os.Stdout, "@ttsc/lint: formatted=%d edits\n", totalFixes)
  }
  return 0
}

// formatCommandResolver wraps a RuleResolver and ensures every format-class
// rule referenced in the loaded plugin options is activated at warn severity,
// even if the user's config omitted it. This lets `ttsc format` format files
// without requiring explicit rule declarations in the project config.
type formatCommandResolver struct {
  inner RuleResolver
}

// ResolveRules implements RuleResolver. It delegates to the inner resolver
// and then upgrades format-rule entries from off to warn so they are applied
// even when the project config omits them.
//
// A user-authored entry whose `ignores` list matches `fileName` is honored
// here even when the entry also carries a `rules` block: the engine already
// skips that entry's rule contributions via `ConfigEntry.matchesFile`, so the
// format command must skip its blanket format-rule upgrade as well. Without
// this guard, `ttsc format` would rewrite files that the user explicitly
// asked the lint config to ignore — the engine's lint walk would skip the
// file but the formatter would still touch it.
//
// The symmetric guard applies to `files`: if every non-IgnoreOnly entry
// carries a `files` filter and `fileName` matches none of them, the engine
// would not run any rules on the file (`ConfigEntry.matchesFile` returns
// false for every entry). The format command must skip its blanket
// format-rule upgrade for the same reason — otherwise `ttsc format` would
// rewrite files that fall outside every entry's scope, e.g. a `.json`
// resolved into the program via `resolveJsonModule` when the only entry
// targets `src/**/*.ts`.
func (r formatCommandResolver) ResolveRules(fileName string) ResolvedRuleConfig {
  resolved := r.inner.ResolveRules(fileName)
  if resolved.Ignored {
    return resolved
  }
  if r.fileIsIgnoredByEntry(fileName) {
    return resolved
  }
  if !r.fileMatchesAnyEntry(fileName) {
    return resolved
  }
  if resolved.Rules == nil {
    resolved.Rules = RuleConfig{}
  }
  for _, name := range r.formatOptionRuleNames() {
    if resolved.Rules.Severity(name) == SeverityOff {
      resolved.Rules[name] = SeverityWarn
    }
  }
  return resolved
}

// fileIsIgnoredByEntry reports whether any non-IgnoreOnly entry in the inner
// ConfigStore has an `ignores` glob that matches `fileName`. IgnoreOnly
// entries are already handled by ResolvedRuleConfig.Ignored — they are
// checked first by ConfigStore.ResolveRules and short-circuit the walk. This
// helper covers the complementary case: an entry that carries both `rules`
// and `ignores`, where the engine skips the entry's rule contributions via
// `ConfigEntry.matchesFile` but the format command must learn the same fact
// independently because its job is to upgrade format rules to `warn`, not to
// read the engine's resolved severity map.
func (r formatCommandResolver) fileIsIgnoredByEntry(fileName string) bool {
  store, ok := r.inner.(*ConfigStore)
  if !ok || store == nil {
    return false
  }
  for _, entry := range store.entries {
    if entry.IgnoreOnly {
      continue
    }
    if entry.matchesIgnores(fileName) {
      return true
    }
  }
  return false
}

// fileMatchesAnyEntry reports whether `fileName` falls inside the `files`
// scope of at least one non-IgnoreOnly entry. An entry without an explicit
// `files` list matches every file by definition (eslint flat-config
// semantics), so a config with any unrestricted non-IgnoreOnly entry returns
// true for every file. The format command treats a `false` result the same
// way the engine does: no entry contributes rules, so the blanket
// format-rule upgrade must be skipped.
//
// Base cases:
//
//   - Empty entries slice: returns `true`. A store with no entries cannot
//     skip a file by scope (the engine has nothing to walk), so format
//     mode must be allowed to apply its default upgrade. Matching engine
//     behavior at `ConfigStore.ResolveRules` for the same input
//     (`Ignored = false`, empty rule map).
//   - All entries are IgnoreOnly: returns `false`. No non-IgnoreOnly
//     entry contributes a `files` scope, so the file is out-of-scope by
//     construction.
//   - Inner resolver is not a *ConfigStore: returns `true` (conservative
//     default). The `files` concept is store-specific; an in-process
//     custom resolver that does not surface a scope cannot have its
//     rule-eligibility reasoned about from the outside, so the format
//     upgrade applies the same as it does for an entry without `files`.
func (r formatCommandResolver) fileMatchesAnyEntry(fileName string) bool {
  store, ok := r.inner.(*ConfigStore)
  if !ok || store == nil {
    return true
  }
  if len(store.entries) == 0 {
    return true
  }
  for _, entry := range store.entries {
    if entry.IgnoreOnly {
      continue
    }
    if entry.matchesFile(fileName) {
      return true
    }
  }
  return false
}

// ActiveRuleNames implements RuleResolver. Returns the union of the inner
// resolver's active rules and every format-option rule that is registered.
func (r formatCommandResolver) ActiveRuleNames() []string {
  active := map[string]struct{}{}
  for _, name := range r.inner.ActiveRuleNames() {
    active[name] = struct{}{}
  }
  for _, name := range r.formatOptionRuleNames() {
    active[name] = struct{}{}
  }
  return sortedKeys(active)
}

// EnabledRuleConfig implements RuleResolver. Merges the inner config with
// the format-option rules so callers see the full active set.
func (r formatCommandResolver) EnabledRuleConfig() RuleConfig {
  enabled := r.inner.EnabledRuleConfig()
  if enabled == nil {
    enabled = RuleConfig{}
  }
  for _, name := range r.formatOptionRuleNames() {
    if enabled.Severity(name) == SeverityOff {
      enabled[name] = SeverityWarn
    }
  }
  return enabled
}

// RuleOptions implements RuleResolver by delegating directly to the inner resolver.
func (r formatCommandResolver) RuleOptions(name string) json.RawMessage {
  return r.inner.RuleOptions(name)
}

// formatOptionRuleNames returns the sorted list of rule names from the inner
// resolver's options that are registered as format rules. These are the rules
// that formatCommandResolver promotes from off to warn.
func (r formatCommandResolver) formatOptionRuleNames() []string {
  options := resolverOptions(r.inner)
  if len(options) == 0 {
    return nil
  }
  names := make([]string, 0, len(options))
  for name := range options {
    if isRegisteredFormatRule(name) {
      names = append(names, name)
    }
  }
  sort.Strings(names)
  return names
}

// resolverOptions extracts the raw options map from a resolver whose concrete
// type exposes one. Returns nil for resolver types that don't carry per-rule
// options (e.g. bare RuleConfig).
func resolverOptions(resolver RuleResolver) RuleOptionsMap {
  switch r := resolver.(type) {
  case InlineRuleResolver:
    return r.Options
  case *ConfigStore:
    return r.options
  default:
    return nil
  }
}

// isRegisteredFormatRule reports whether `name` is both registered in the
// global rule registry and tagged as a format rule via the FormatRule marker.
func isRegisteredFormatRule(name string) bool {
  rule, ok := registered.rules[name]
  return ok && isFormatRule(rule)
}

// sortedKeys returns the sorted slice of keys from a string-keyed set.
func sortedKeys(input map[string]struct{}) []string {
  names := make([]string, 0, len(input))
  for name := range input {
    names = append(names, name)
  }
  sort.Strings(names)
  return names
}

// filterFormatFindings keeps only findings produced by FormatRule
// implementations that also carry at least one autofix edit.
// `RunFormat` calls this so the format-only subcommand never applies
// lint-class edits, and so a contributor format rule that reports a
// fixable diagnostic via bare `ctx.Report` (no edits attached) does
// not silently disappear — format mode is write-only, so a no-edit
// finding has nothing to do here. `RunFix`, by contrast, applies
// every finding regardless of category — fix is the run-everything
// entry point.
func filterFormatFindings(findings []*Finding) []*Finding {
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding != nil && finding.IsFormat && len(finding.Fix) > 0 {
      out = append(out, finding)
    }
  }
  return out
}
