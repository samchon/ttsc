package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "sort"
  "sync"
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
  rules, err := loadFormatRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  resolver, err := newFormatCommandResolver(rules, opts.cwd, "")
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
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
  // ruleNames memoizes formatOptionRuleNames. The resolver's option set is
  // immutable for the whole run, so the sorted format-rule slice is computed
  // once and reused across ResolveRules (per file per pass), ActiveRuleNames,
  // and EnabledRuleConfig. The field is a pointer so a nil zero value stays
  // valid: callers that build formatCommandResolver{inner: ...} without it
  // (tests, lsp) fall back to direct computation, and copying the struct by
  // value (it is stored in the engine's RuleResolver interface and passed
  // around as a value) shares the same underlying cache rather than copying a
  // sync.Once lock.
  ruleNames *formatRuleNamesCache
  // entryDecisions memoizes the per-fileName ignored/matches decision that
  // ResolveRules derives from fileIsIgnoredByEntry and fileMatchesAnyEntry.
  // Both walk store.entries with glob matching and are recomputed identically
  // for the same fileName on every format pass, so the result is cached once
  // per file and reused. The field is a pointer (a *sync.Map) so the nil zero
  // value stays valid for construction sites that omit it, and copying the
  // resolver by value shares the same underlying map. sync.Map handles the
  // engine's concurrent per-file ResolveRules calls without an extra lock.
  entryDecisions *sync.Map
  // defaultOptions holds the always-on format rules' options (from
  // expandFormatBlock) to apply when the project config declares no `format`
  // block — no block in lint.config.*, or no config file at all. nil when a
  // format block is configured, so that block wins entirely. Keys are canonical
  // format rule names; values are the marshaled options blob each rule decodes,
  // exactly as a configured block would supply them.
  defaultOptions RuleOptionsMap
}

// newFormatCommandResolver wraps inner for the format command / LSP buffer path.
// When inner declares no `format` rules (no `format` block in lint.config.*, or
// no config file at all) it loads the documented default format rules, letting
// the nearest .vscode/settings.json under startDir override the indentation/eol
// keys. language scopes the settings.json language section ("" skips sections,
// e.g. the project-wide CLI path). A configured `format` block leaves
// defaultOptions nil so the block stays authoritative.
func newFormatCommandResolver(inner RuleResolver, startDir string, language string) (formatCommandResolver, error) {
  r := formatCommandResolver{
    inner:          inner,
    ruleNames:      &formatRuleNamesCache{},
    entryDecisions: &sync.Map{},
  }
  if !hasInnerFormatRules(inner) {
    opts, err := defaultFormatOptions(editorFormatOverrides(startDir, language))
    if err != nil {
      return formatCommandResolver{}, err
    }
    r.defaultOptions = opts
  }
  return r, nil
}

// hasInnerFormatRules reports whether inner already carries format-rule options,
// i.e. the project configured a `format` block (format/* options only ever come
// from a block). When true the block is authoritative and defaults are skipped.
func hasInnerFormatRules(inner RuleResolver) bool {
  for name := range resolverOptions(inner) {
    if isRegisteredFormatRule(name) {
      return true
    }
  }
  return false
}

// defaultFormatOptions expands the always-on default format ruleset (optionally
// overridden by editor settings) into the per-rule options map the resolver
// returns through RuleOptions. It reuses expandFormatBlock so the defaults are
// produced by exactly the same code path as a user-authored format block.
func defaultFormatOptions(overrides map[string]any) (RuleOptionsMap, error) {
  expanded, err := expandFormatBlock(overrides)
  if err != nil {
    return nil, err
  }
  out := make(RuleOptionsMap, len(expanded))
  for name, entry := range expanded {
    tuple, ok := entry.([]any)
    if !ok || len(tuple) < 2 {
      continue
    }
    options, ok := tuple[1].(map[string]any)
    if !ok {
      continue
    }
    raw, err := json.Marshal(options)
    if err != nil {
      return nil, err
    }
    out[name] = raw
  }
  return out, nil
}

// formatRuleNamesCache lazily computes and stores the sorted format-rule name
// slice for a resolver. sync.Once guarantees a single computation even when
// ResolveRules runs concurrently across files in the engine's parallel walk.
type formatRuleNamesCache struct {
  once  sync.Once
  names []string
}

// formatEntryDecision is the cached per-fileName outcome of the two entry-scope
// checks ResolveRules runs before applying its format-rule upgrade.
type formatEntryDecision struct {
  ignoredByEntry bool
  matchesEntry   bool
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
  decision := r.entryDecision(fileName)
  if decision.ignoredByEntry {
    return resolved
  }
  if !decision.matchesEntry {
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

// entryDecision returns the per-fileName ignored/matches outcome that
// ResolveRules needs, computing it from fileIsIgnoredByEntry and
// fileMatchesAnyEntry on first use and reusing it on later passes. When the
// memo is absent (a resolver built without entryDecisions, e.g. in tests or
// lsp) it computes the decision directly so behavior is identical, just
// uncached.
func (r formatCommandResolver) entryDecision(fileName string) formatEntryDecision {
  if r.entryDecisions == nil {
    return r.computeEntryDecision(fileName)
  }
  if cached, ok := r.entryDecisions.Load(fileName); ok {
    return cached.(formatEntryDecision)
  }
  decision := r.computeEntryDecision(fileName)
  // LoadOrStore keeps the first writer's value so concurrent passes over the
  // same file agree; the decision is a pure function of fileName, so either
  // value is correct.
  actual, _ := r.entryDecisions.LoadOrStore(fileName, decision)
  return actual.(formatEntryDecision)
}

// computeEntryDecision runs the two uncached entry-scope checks behind
// entryDecision.
func (r formatCommandResolver) computeEntryDecision(fileName string) formatEntryDecision {
  return formatEntryDecision{
    ignoredByEntry: r.fileIsIgnoredByEntry(fileName),
    matchesEntry:   r.fileMatchesAnyEntry(fileName),
  }
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
  matched, _ := r.anyNonIgnoreEntry(func(entry *ConfigEntry) bool {
    return entry.matchesIgnores(fileName)
  })
  return matched
}

// anyNonIgnoreEntry resolves the inner resolver to its concrete *ConfigStore
// once and reports whether any non-IgnoreOnly entry satisfies `pred`. The
// second return value is false when the inner resolver is not a *ConfigStore
// (or is a nil one), letting each caller pick its own non-store default. This
// collapses the shared store-resolution and entry-walk that fileIsIgnoredByEntry
// and fileMatchesAnyEntry would otherwise duplicate; the per-caller default and
// the empty-entries base case stay in the callers where they differ.
func (r formatCommandResolver) anyNonIgnoreEntry(pred func(*ConfigEntry) bool) (matched bool, hasStore bool) {
  store, ok := r.inner.(*ConfigStore)
  if !ok || store == nil {
    return false, false
  }
  for i := range store.entries {
    entry := &store.entries[i]
    if entry.IgnoreOnly {
      continue
    }
    if pred(entry) {
      return true, true
    }
  }
  return false, true
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
  matched, hasStore := r.anyNonIgnoreEntry(func(entry *ConfigEntry) bool {
    return entry.matchesFile(fileName)
  })
  if !hasStore {
    // Not a *ConfigStore: conservative default, see the doc comment above.
    return true
  }
  // A store with no entries (or only IgnoreOnly ones that the walk skipped)
  // produces matched == false; an empty entries slice must still return true
  // so format mode applies its default upgrade, matching ConfigStore behavior.
  // The all-IgnoreOnly case is distinguished by a non-empty entries slice.
  if !matched && len(r.storeEntries()) == 0 {
    return true
  }
  return matched
}

// storeEntries returns the inner resolver's config entries, or nil when the
// inner resolver is not a *ConfigStore. Used by fileMatchesAnyEntry to tell the
// empty-entries base case (return true) apart from the all-IgnoreOnly case
// (return false) after anyNonIgnoreEntry reports no match.
func (r formatCommandResolver) storeEntries() []ConfigEntry {
  if store, ok := r.inner.(*ConfigStore); ok && store != nil {
    return store.entries
  }
  return nil
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

// RuleOptions implements RuleResolver. It prefers the inner resolver's options
// and falls back to the default format options for rules the project did not
// configure, so the default always-on rules receive their (possibly
// settings.json-overridden) options.
func (r formatCommandResolver) RuleOptions(name string) json.RawMessage {
  if raw := r.inner.RuleOptions(name); len(raw) > 0 {
    return raw
  }
  if r.defaultOptions != nil {
    if raw, ok := r.defaultOptions[name]; ok {
      return raw
    }
  }
  return nil
}

// formatOptionRuleNames returns the sorted list of rule names from the inner
// resolver's options that are registered as format rules. These are the rules
// that formatCommandResolver promotes from off to warn.
func (r formatCommandResolver) formatOptionRuleNames() []string {
  if r.ruleNames == nil {
    // Nil cache (a resolver built without the memo, e.g. in tests or lsp):
    // compute directly. Construction sites that want the memo set ruleNames.
    return r.computeFormatOptionRuleNames()
  }
  r.ruleNames.once.Do(func() {
    r.ruleNames.names = r.computeFormatOptionRuleNames()
  })
  return r.ruleNames.names
}

// computeFormatOptionRuleNames does the uncached work behind
// formatOptionRuleNames: collect the inner resolver's option names that are
// registered format rules, sorted. The result order is stable (sorted) so
// memoizing it does not change any caller's observed ordering.
func (r formatCommandResolver) computeFormatOptionRuleNames() []string {
  options := resolverOptions(r.inner)
  names := make([]string, 0, len(options))
  for name := range options {
    if isRegisteredFormatRule(name) {
      names = append(names, name)
    }
  }
  if len(names) == 0 {
    // No `format` block configured: fall back to the default always-on set so
    // the formatter still runs, with documented defaults plus any
    // .vscode/settings.json overrides folded into defaultOptions.
    for name := range r.defaultOptions {
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
