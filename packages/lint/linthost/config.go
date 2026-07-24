package linthost

import (
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "net/url"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "sync"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// configLoaderTimeout caps every `ttsx`/`node -e` subprocess that
// evaluates a user-supplied lint config. The JS factory imposes the
// same 60 s budget on its mirroring spawnSync; without the Go-side cap
// a runaway user config would hang `ttsc-lint` forever, while
// `ttsc`/`pnpm` upstream of it stays responsive. 60 s is generous
// enough for cold ttsx starts on CI runners and tight enough to keep
// user-visible feedback under a minute.
const configLoaderTimeout = 60 * time.Second

// Severity is the `error | warning | off` ladder.
type Severity int

const (
  SeverityOff Severity = iota
  SeverityWarn
  SeverityError
)

func (s Severity) String() string {
  switch s {
  case SeverityError:
    return "error"
  case SeverityWarn:
    return "warning"
  case SeverityOff:
    return "off"
  }
  return "unknown"
}

// PluginEntry mirrors the shape ttsc serializes into `--plugins-json`.
//
// `Config` carries the original tsconfig plugin entry. `Name` and `Stage`
// come from the JS plugin descriptor returned to the ttsc host.
type PluginEntry struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

// ParsePlugins decodes the `--plugins-json` payload.
func ParsePlugins(text string) ([]PluginEntry, error) {
  if strings.TrimSpace(text) == "" {
    return nil, nil
  }
  var entries []PluginEntry
  if err := json.Unmarshal([]byte(text), &entries); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: invalid --plugins-json: %w", err)
  }
  return entries, nil
}

// FindLintEntry returns the active lint entry. ttsc orders check plugins before
// transform plugins before invoking native sidecars, so lint inspects authored
// source even when transform plugins are also configured.
func FindLintEntry(entries []PluginEntry) (*PluginEntry, error) {
  for i := range entries {
    if entries[i].Name == "@ttsc/lint" {
      return &entries[i], nil
    }
  }
  return nil, nil
}

// RuleConfig captures the resolved per-rule severity. The map is keyed by
// rule name (e.g. "no-var").
type RuleConfig map[string]Severity

// RuleOptionsMap captures the rule-specific options payload, keyed by rule
// name. Severity-only rules never appear here. A single option slot preserves
// its JSON shape; multiple positional slots are encoded as an array. Each rule
// decodes the payload according to its public option type on demand.
type RuleOptionsMap map[string]json.RawMessage

// ProjectRuleSetting is the global declaration resolved for one registered
// project rule. Declared distinguishes a missing entry from an explicit off.
type ProjectRuleSetting struct {
  Declared bool
  Severity Severity
  Options  json.RawMessage
}

// ResolvedRuleConfig is the complete rule setting that applies to one source
// file. Rules and Options are folded from the same matching config entries so
// an option tuple can never cross a files/ignores boundary independently of
// its severity.
//
// `Ignored` means an `ignores`-only config entry matched the file and the
// engine should skip linting it entirely. `OutOfScope` means the store has at
// least one rule-bearing entry but none applies to this file. Keeping the two
// states distinct lets wrappers preserve entry-local ignores: one entry may
// reject a file while another matching entry still contributes rules.
type ResolvedRuleConfig struct {
  Rules   RuleConfig
  Options RuleOptionsMap
  // OptionsResolved distinguishes an authoritative empty per-file option map
  // from a legacy custom resolver that still supplies options exclusively via
  // RuleResolver.RuleOptions.
  OptionsResolved bool
  Ignored         bool
  OutOfScope      bool
}

// RuleOptions returns the file-resolved option payload for name. Built-in
// aliases are normalized on lookup so the same key selects both severity and
// options.
func (r ResolvedRuleConfig) RuleOptions(name string) json.RawMessage {
  if raw := r.Options[name]; len(raw) > 0 {
    return raw
  }
  if raw := r.Options[normalizeBuiltinRuleName(name)]; len(raw) > 0 {
    return raw
  }
  return nil
}

// RuleResolver is the engine-facing view of a resolved lint configuration.
// Implementations include RuleConfig (severity-only, no options),
// InlineRuleResolver (a severity map plus per-rule options), and *ConfigStore
// (a parsed lint config file, with per-file glob resolution for both severity
// and options).
type RuleResolver interface {
  // ResolveRules returns the effective severities and option payloads for the
  // given source file. Implementations that support `files`/`ignores`
  // patterns apply both halves of each rule setting here; flat RuleConfig
  // always returns all severities unchanged and no options.
  ResolveRules(fileName string) ResolvedRuleConfig
  // ActiveRuleNames returns the sorted names of every rule that is not SeverityOff
  // in at least one config entry. Used to build the engine's dispatch table.
  ActiveRuleNames() []string
  // EnabledRuleConfig returns the project-wide severity map for rules that are
  // not SeverityOff. Where multiple entries disagree, SeverityError wins.
  EnabledRuleConfig() RuleConfig
  // RuleOptions is the file-agnostic compatibility lookup used by flat and
  // metadata-only consumers. Runtime file binding reads
  // ResolveRules(fileName).RuleOptions(name), which is authoritative for
  // scoped resolvers. Returns nil for severity-only and unknown rules.
  RuleOptions(name string) json.RawMessage
  // ResolveProjectRules folds global declarations for registered project-rule
  // names. A mention under a files selector is rejected because project state
  // has no file identity, except when the same built-in name also owns a file
  // rule; that scoped declaration remains exclusively file-local.
  ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error)
}

// RuleOptionsVariantsResolver is an optional extension for resolvers that can
// declare more than one option payload for a rule. Engine construction uses
// it to validate every files/extends variant before any file is visited.
// Custom resolvers that omit this interface remain compatible through the
// single RuleResolver.RuleOptions fallback.
type RuleOptionsVariantsResolver interface {
  RuleOptionsVariants(name string) []json.RawMessage
}

// resolvedRuleOptionsVariants returns every option shape a rule may receive.
// File-scoped resolvers expose all declarations through the internal
// extension; flat and external resolvers retain the RuleOptions fallback.
func resolvedRuleOptionsVariants(resolver RuleResolver, name string) []json.RawMessage {
  if variants, ok := resolver.(RuleOptionsVariantsResolver); ok {
    if values := variants.RuleOptionsVariants(name); len(values) > 0 {
      return values
    }
  }
  return []json.RawMessage{append(json.RawMessage(nil), resolver.RuleOptions(name)...)}
}

// boundProjectRuleResolver retains the one project-wide resolution performed
// while loading a config. Engine construction reads a defensive copy instead
// of folding the extends chain a second time.
type boundProjectRuleResolver struct {
  RuleResolver
  settings map[string]ProjectRuleSetting
}

func bindProjectRuleResolver(resolver RuleResolver) (RuleResolver, error) {
  if resolver == nil {
    resolver = RuleConfig{}
  }
  settings, err := resolver.ResolveProjectRules(allProjectRuleNames())
  if err != nil {
    return nil, err
  }
  return boundProjectRuleResolver{RuleResolver: resolver, settings: settings}, nil
}

func (r boundProjectRuleResolver) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  settings := make(map[string]ProjectRuleSetting, len(names))
  for _, name := range names {
    setting := r.settings[name]
    setting.Options = append(json.RawMessage(nil), setting.Options...)
    settings[name] = setting
  }
  return settings, nil
}

func (r boundProjectRuleResolver) RuleOptionsVariants(name string) []json.RawMessage {
  return resolvedRuleOptionsVariants(r.RuleResolver, name)
}

func (r boundProjectRuleResolver) ConfigPaths() []string {
  resolver, ok := r.RuleResolver.(interface{ ConfigPaths() []string })
  if !ok {
    return nil
  }
  return resolver.ConfigPaths()
}

func (r boundProjectRuleResolver) ConfigDirectories() []string {
  resolver, ok := r.RuleResolver.(interface{ ConfigDirectories() []string })
  if !ok {
    return nil
  }
  return resolver.ConfigDirectories()
}

// ResolveRules implements RuleResolver. A flat RuleConfig has no glob scoping,
// so every file receives the full map unchanged.
func (c RuleConfig) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{
    Rules:           normalizeRuleConfigKeys(c),
    OptionsResolved: true,
  }
}

// ActiveRuleNames implements RuleResolver. Returns rule names whose severity
// is not SeverityOff, sorted for deterministic engine dispatch-table construction.
func (c RuleConfig) ActiveRuleNames() []string {
  return sortedRuleNames(normalizeRuleConfigKeys(c), func(sev Severity) bool { return sev != SeverityOff })
}

// EnabledRuleConfig implements RuleResolver. Returns a copy containing only the
// non-off entries; used to populate engine state and diagnostic reporting.
func (c RuleConfig) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  for name, sev := range c {
    if sev != SeverityOff {
      out[normalizeBuiltinRuleName(name)] = sev
    }
  }
  return out
}

// RuleOptions on a bare RuleConfig is always nil — this form is the
// severity-only path used by Go unit tests and rule constructors that
// predate option support.
func (RuleConfig) RuleOptions(string) json.RawMessage { return nil }

// ResolveProjectRules treats a flat RuleConfig as one global declaration.
func (c RuleConfig) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  normalized := normalizeRuleConfigKeys(c)
  out := make(map[string]ProjectRuleSetting, len(names))
  for _, name := range names {
    severity, declared := normalized[normalizeBuiltinRuleName(name)]
    out[name] = ProjectRuleSetting{Declared: declared, Severity: severity}
  }
  return out, nil
}

func normalizeRuleConfigKeys(c RuleConfig) RuleConfig {
  if len(c) == 0 {
    return c
  }
  out := RuleConfig{}
  for name, sev := range c {
    out[normalizeBuiltinRuleName(name)] = sev
  }
  return out
}

// InlineRuleResolver pairs a severity map with an options map. The fields
// are public so tests can construct one without going through
// ParseRulesWithOptions.
type InlineRuleResolver struct {
  Rules   RuleConfig
  Options RuleOptionsMap
}

// ResolveRules implements RuleResolver. Inline rules have no glob scoping;
// the full map applies to every file.
func (r InlineRuleResolver) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{
    Rules:           normalizeRuleConfigKeys(r.Rules),
    Options:         normalizeRuleOptionsKeys(r.Options),
    OptionsResolved: true,
  }
}

func normalizeRuleOptionsKeys(options RuleOptionsMap) RuleOptionsMap {
  if len(options) == 0 {
    return nil
  }
  normalized := make(RuleOptionsMap, len(options))
  for name, raw := range options {
    normalized[normalizeBuiltinRuleName(name)] = append(json.RawMessage(nil), raw...)
  }
  return normalized
}

// ActiveRuleNames implements RuleResolver by delegating to the inner RuleConfig.
func (r InlineRuleResolver) ActiveRuleNames() []string {
  return r.Rules.ActiveRuleNames()
}

// EnabledRuleConfig implements RuleResolver by delegating to the inner RuleConfig.
func (r InlineRuleResolver) EnabledRuleConfig() RuleConfig {
  return r.Rules.EnabledRuleConfig()
}

// RuleOptions implements RuleResolver. Returns the raw JSON options blob for
// `name`, or nil when the rule was configured without options or the name is
// unknown.
func (r InlineRuleResolver) RuleOptions(name string) json.RawMessage {
  if r.Options == nil {
    return nil
  }
  if raw := r.Options[name]; len(raw) > 0 {
    return raw
  }
  canonical := normalizeBuiltinRuleName(name)
  if raw := r.Options[canonical]; len(raw) > 0 {
    return raw
  }
  return nil
}

// ResolveProjectRules treats inline rules as global and preserves their
// explicit options tuple.
func (r InlineRuleResolver) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  settings, _ := r.Rules.ResolveProjectRules(names)
  for _, name := range names {
    setting := settings[name]
    setting.Options = append(json.RawMessage(nil), r.RuleOptions(name)...)
    settings[name] = setting
  }
  return settings, nil
}

// ConfigStore holds the parsed representation of a lint config file. It
// implements RuleResolver with per-file glob scoping: ResolveRules walks the
// entries in declaration order and folds each matching rule's severity and
// options together. A later option tuple replaces the inherited payload; a
// later severity-only declaration preserves options from an earlier matching
// entry and cannot borrow them from an entry that did not match the file.
// https://eslint.org/docs/latest/use/configure/rules#using-configuration-files
//
// A config file is a single `ITtscLintConfig` object. Its `extends` field
// names another config file to fold in first; the extends chain produces one
// ConfigEntry per file, the extends-target entries declared before the
// extending file's own entry so local rules win on collision.
type ConfigStore struct {
  directories    []string
  entries        []ConfigEntry
  paths          []string
  resolutionRoot string
}

// ConfigPaths returns the config and extends files that produced this store.
// The paths are retained as exact dependencies even when no rule declares
// additional project inputs.
func (s *ConfigStore) ConfigPaths() []string {
  if s == nil {
    return nil
  }
  return append([]string(nil), s.paths...)
}

// ConfigDirectories returns resolution-topology directories whose immediate
// entries can change which executable-config module Node selects. Consumers
// watch these as cold configuration inputs rather than ordinary rule data.
func (s *ConfigStore) ConfigDirectories() []string {
  if s == nil {
    return nil
  }
  return append([]string(nil), s.directories...)
}

// RuleOptions implements the file-agnostic RuleResolver compatibility method.
// Engine execution does not use this representative value: ResolveRules
// carries the matching file's options. Callers that only understand the older
// interface observe the final declared tuple, preserving the former flat
// resolver behavior without storing a second source of truth.
func (s *ConfigStore) RuleOptions(name string) json.RawMessage {
  if s == nil {
    return nil
  }
  canonical := normalizeBuiltinRuleName(name)
  var selected json.RawMessage
  for _, entry := range s.entries {
    if raw := entry.Options[canonical]; len(raw) > 0 {
      selected = raw
    }
  }
  return append(json.RawMessage(nil), selected...)
}

// flattenOptions returns the final declared payload for each rule without
// claiming that it applies to any particular file. Metadata-only consumers
// use this to enumerate option-bearing rules; execution always uses
// ResolveRules instead.
func (s *ConfigStore) flattenOptions() RuleOptionsMap {
  if s == nil {
    return nil
  }
  options := RuleOptionsMap{}
  for _, entry := range s.entries {
    for name, raw := range entry.Options {
      options[normalizeBuiltinRuleName(name)] = append(json.RawMessage(nil), raw...)
    }
  }
  return options
}

// RuleOptionsVariants exposes every entry-local payload (including a nil
// severity-only declaration) so engine construction validates the full
// files/extends surface rather than whichever tuple happened to be parsed
// last.
func (s *ConfigStore) RuleOptionsVariants(name string) []json.RawMessage {
  if s == nil {
    return nil
  }
  canonical := normalizeBuiltinRuleName(name)
  variants := make([]json.RawMessage, 0)
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    if _, declared := entry.Rules[canonical]; !declared {
      continue
    }
    variants = append(variants, append(json.RawMessage(nil), entry.Options[canonical]...))
  }
  return variants
}

// ConfigEntry is the parsed form of one config file in the extends chain.
// BaseDir anchors glob resolution; Files and Ignores are the pattern lists.
// IgnoreOnly marks entries that carry only `ignores` (no `files`, no `rules`)
// — these are evaluated first in ResolveRules and short-circuit the walk when
// matched.
type ConfigEntry struct {
  BaseDir          string
  Files            []string
  HasFilesSelector bool
  Ignores          []string
  Rules            RuleConfig
  Options          RuleOptionsMap
  IgnoreOnly       bool
}

// ResolveRules implements RuleResolver. Ignore-only entries are checked first;
// if one matches, the file is marked Ignored and linting is skipped entirely.
// Otherwise the entries are walked in declaration order and the last matching
// entry wins (later entries shadow earlier ones for the same rule name).
func (s *ConfigStore) ResolveRules(fileName string) ResolvedRuleConfig {
  if s == nil {
    return ResolvedRuleConfig{Rules: RuleConfig{}, OptionsResolved: true}
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly && entry.matchesIgnores(fileName) {
      return ResolvedRuleConfig{Rules: RuleConfig{}, OptionsResolved: true, Ignored: true}
    }
  }
  out := RuleConfig{}
  options := RuleOptionsMap{}
  hasEntries := false
  matchedEntry := false
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    hasEntries = true
    if !entry.matchesFile(fileName) {
      continue
    }
    matchedEntry = true
    for name, sev := range entry.Rules {
      canonical := normalizeBuiltinRuleName(name)
      out[canonical] = sev
      if raw := entry.Options[canonical]; len(raw) > 0 {
        options[canonical] = append(json.RawMessage(nil), raw...)
      }
    }
  }
  return ResolvedRuleConfig{
    Rules:           out,
    Options:         options,
    OptionsResolved: true,
    OutOfScope:      hasEntries && !matchedEntry,
  }
}

// ActiveRuleNames implements RuleResolver. Returns the sorted union of all rule
// names that are not SeverityOff across every non-ignore-only config entry,
// regardless of which files they apply to. The engine uses this to build the
// per-rule dispatch table before file iteration begins.
func (s *ConfigStore) ActiveRuleNames() []string {
  if s == nil {
    return nil
  }
  active := RuleConfig{}
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      if sev != SeverityOff {
        active[normalizeBuiltinRuleName(name)] = sev
      }
    }
  }
  return sortedRuleNames(active, func(Severity) bool { return true })
}

// EnabledRuleConfig implements RuleResolver. Returns the project-wide severity
// map for non-off rules. Where multiple entries configure the same rule,
// SeverityError is sticky — it cannot be downgraded by a later warning entry.
func (s *ConfigStore) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  if s == nil {
    return out
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      if sev == SeverityOff {
        continue
      }
      canonical := normalizeBuiltinRuleName(name)
      if out[canonical] != SeverityError {
        out[canonical] = sev
      }
    }
  }
  return out
}

// ResolveProjectRules folds the extends-expanded entries base-first. Only
// global entries participate. A project-only rule mentioned under files is an
// invalid configuration, including off declarations and option tuples. A
// built-in companion sharing a file-rule name ignores that scoped declaration
// so the file rule can retain its existing per-file configuration.
func (s *ConfigStore) ResolveProjectRules(names []string) (map[string]ProjectRuleSetting, error) {
  out := make(map[string]ProjectRuleSetting, len(names))
  wanted := make(map[string]string, len(names))
  for _, name := range names {
    canonical := normalizeBuiltinRuleName(name)
    wanted[canonical] = name
    out[name] = ProjectRuleSetting{}
  }
  if s == nil {
    return out, nil
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for configuredName, severity := range entry.Rules {
      name, projectRule := wanted[normalizeBuiltinRuleName(configuredName)]
      if !projectRule {
        continue
      }
      if entry.HasFilesSelector {
        // A built-in project companion shares its public name with a file
        // rule. Keep the file-scoped declaration for that file rule, but do
        // not turn it into project-wide state: only a global declaration can
        // activate the companion and its consumers.
        if LookupRule(name) != nil {
          continue
        }
        return nil, fmt.Errorf(
          "@ttsc/lint: project rule %q cannot be configured in an entry with files",
          name,
        )
      }
      setting := out[name]
      setting.Declared = true
      setting.Severity = severity
      if raw := entry.Options[normalizeBuiltinRuleName(configuredName)]; len(raw) > 0 {
        setting.Options = append(json.RawMessage(nil), raw...)
      }
      out[name] = setting
    }
  }
  return out, nil
}

// Flatten returns the unconstrained union of all non-ignore-only entries,
// including SeverityOff rules. Used by LoadRuleConfig (callers that expect a
// plain RuleConfig). Later entries shadow earlier ones for the same rule name.
func (s *ConfigStore) Flatten() RuleConfig {
  out := RuleConfig{}
  if s == nil {
    return out
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly {
      continue
    }
    for name, sev := range entry.Rules {
      out[normalizeBuiltinRuleName(name)] = sev
    }
  }
  return out
}

func (e ConfigEntry) matchesFile(fileName string) bool {
  if len(e.Files) > 0 && !matchAnyPattern(e.BaseDir, e.Files, fileName) {
    return false
  }
  if e.matchesIgnores(fileName) {
    return false
  }
  return true
}

func (e ConfigEntry) matchesIgnores(fileName string) bool {
  return len(e.Ignores) > 0 && matchAnyPattern(e.BaseDir, e.Ignores, fileName)
}

// ParseRules normalizes a rule severity map.
//
// Severity values:
//   - `"off"` → SeverityOff
//   - `"warning"` → SeverityWarn
//   - `"error"` → SeverityError
//
// Anything else returns an error (no silent fallback — typos in a rule
// severity should be loud).
func ParseRules(raw any) (RuleConfig, error) {
  cfg, _, err := ParseRulesWithOptions(raw)
  return cfg, err
}

// ParseRulesWithOptions accepts either a severity literal or a
// `[severity, ...options]` tuple per rule and returns the severity map
// alongside an options map keyed by rule name. The options map only
// contains entries for rules whose configuration carries option slots.
func ParseRulesWithOptions(raw any) (RuleConfig, RuleOptionsMap, error) {
  if raw == nil {
    return RuleConfig{}, RuleOptionsMap{}, nil
  }
  dict, ok := raw.(map[string]any)
  if !ok {
    return nil, nil, fmt.Errorf("@ttsc/lint: \"rules\" must be an object, got %T", raw)
  }
  cfg := make(RuleConfig, len(dict))
  opts := make(RuleOptionsMap)
  for name, value := range dict {
    sev, raw, err := parseRuleEntry(value)
    if err != nil {
      return nil, nil, fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    cfg[name] = sev
    if len(raw) > 0 {
      opts[name] = raw
    }
  }
  return cfg, opts, nil
}

// parseRuleEntry splits a rule entry into its severity and optional positional
// options. A single option keeps its JSON shape for existing object-option
// rules. Two or more options become a JSON array so canonical ESLint rules
// with several positional slots can decode them without parser special cases.
func parseRuleEntry(value any) (Severity, json.RawMessage, error) {
  if tuple, ok := value.([]any); ok {
    if len(tuple) == 0 {
      return SeverityOff, nil, fmt.Errorf("severity tuple must not be empty")
    }
    sev, err := parseSeverity(tuple[0])
    if err != nil {
      return SeverityOff, nil, err
    }
    if len(tuple) == 1 {
      return sev, nil, nil
    }
    if len(tuple) == 2 && tuple[1] == nil {
      return sev, nil, nil
    }
    var payload any = tuple[1]
    if len(tuple) > 2 {
      payload = tuple[1:]
    }
    encoded, err := json.Marshal(payload)
    if err != nil {
      return SeverityOff, nil, fmt.Errorf("encode options: %w", err)
    }
    return sev, encoded, nil
  }
  sev, err := parseSeverity(value)
  return sev, nil, err
}

// parseExternalConfigRules is a convenience wrapper used by unit tests that
// only need a flat RuleConfig from an already-deserialized config object. Glob
// scoping and options are discarded.
func parseExternalConfigRules(raw any) (RuleConfig, error) {
  store, err := parseExternalConfigStore(raw, "")
  if err != nil {
    return nil, err
  }
  return store.Flatten(), nil
}

// parseExternalConfigStore parses a single `ITtscLintConfig` object into a
// *ConfigStore. `configDir` anchors glob resolution and `extends` lookups; it
// is empty for in-memory inputs that do not load from a real file.
func parseExternalConfigStore(raw any, configDir string) (*ConfigStore, error) {
  return collectConfigStore(raw, configDir, "")
}

// collectConfigStore parses a single `ITtscLintConfig` object into a fresh
// *ConfigStore. `rootPath` is the absolute path of the file `raw` was loaded
// from, or "" for in-memory inputs; when set it seeds the `extends` cycle
// guard so a config that `extends` itself (directly or transitively) is
// rejected.
func collectConfigStore(raw any, configDir, rootPath string) (*ConfigStore, error) {
  return collectConfigStoreWithin(raw, configDir, rootPath, configDir)
}

func collectConfigStoreWithin(
  raw any,
  configDir string,
  rootPath string,
  resolutionRoot string,
) (*ConfigStore, error) {
  store := &ConfigStore{resolutionRoot: filepath.Clean(resolutionRoot)}
  var chain []string
  if rootPath != "" {
    rootPath = filepath.Clean(rootPath)
    chain = []string{rootPath}
    store.paths = append(store.paths, rootPath)
  }
  if err := collectConfigObject(store, raw, configDir, "config", chain); err != nil {
    return nil, err
  }
  return store, nil
}

// extendsDepthLimit caps how many `extends` hops collectConfigObject will
// follow. The cycle check in appendExtendsLink already rejects every loop;
// this is a backstop so a config chain that escapes that check (e.g. a future
// change that resolves the same file under two different cleaned paths) still
// fails fast instead of spawning an unbounded run of `ttsx`/`node`
// config-loader subprocesses — one per hop.
const extendsDepthLimit = 32

// appendExtendsLink validates that following the `extends` target at `next`
// neither closes a cycle nor exceeds extendsDepthLimit, then returns `chain`
// extended by `next`. `chain` holds the resolved absolute paths of every
// config file already on the current `extends` lineage, root first. The guard
// runs before loadConfigFile so a cyclic chain fails fast instead of
// re-reading files (and re-spawning subprocesses) without bound.
func appendExtendsLink(chain []string, next string) ([]string, error) {
  for i, prior := range chain {
    if prior == next {
      // chain[i:] capped at its own length so append allocates a fresh
      // backing array rather than mutating the caller's `chain`.
      cycle := append(chain[i:len(chain):len(chain)], next)
      return nil, fmt.Errorf(
        "@ttsc/lint: extends cycle detected: %s",
        strings.Join(cycle, " -> "),
      )
    }
  }
  if len(chain) >= extendsDepthLimit {
    return nil, fmt.Errorf(
      "@ttsc/lint: extends chain exceeds the depth limit of %d: %s -> ...",
      extendsDepthLimit,
      strings.Join(chain, " -> "),
    )
  }
  extended := make([]string, len(chain)+1)
  copy(extended, chain)
  extended[len(chain)] = next
  return extended, nil
}

// collectConfigObject parses one `ITtscLintConfig` object into `store`,
// appending one ConfigEntry for the object's own rules (and, recursively, the
// entries of any `extends`-named config file). The extends-target's entries
// are appended first so the extending file's local rules win on collision.
//
// `chain` carries the resolved absolute paths of the config files already on
// the current `extends` lineage (root first); appendExtendsLink consults it to
// reject cyclic or pathologically deep chains before another file is read.
func collectConfigObject(store *ConfigStore, raw any, baseDir, path string, chain []string) error {
  if raw == nil {
    return nil
  }
  obj, ok := raw.(map[string]any)
  if !ok {
    return fmt.Errorf("@ttsc/lint: %s must be an ITtscLintConfig object, got %T", path, raw)
  }
  if err := rejectUnknownConfigKeys(obj, path); err != nil {
    return err
  }

  if extended, hasExtends := obj["extends"]; hasExtends && extended != nil {
    extendsStr, ok := extended.(string)
    if !ok {
      return fmt.Errorf("@ttsc/lint: %s.extends must be a string path to another config file, got %T", path, extended)
    }
    if strings.TrimSpace(extendsStr) == "" {
      return fmt.Errorf("@ttsc/lint: %s.extends must not be empty", path)
    }
    location := extendsStr
    if !filepath.IsAbs(location) {
      location = filepath.Join(baseDir, location)
    }
    location = filepath.Clean(location)
    extendedChain, err := appendExtendsLink(chain, location)
    if err != nil {
      return err
    }
    if !containsPath(store.paths, location) {
      store.paths = append(store.paths, location)
    }
    evaluated, err := loadConfigFileEvaluationWithin(
      location,
      store.resolutionRoot,
    )
    if err != nil {
      return err
    }
    appendConfigPaths(store, evaluated.dependencies)
    appendConfigDirectories(store, evaluated.dependencyDirectories)
    if err := collectConfigObject(store, evaluated.value, filepath.Dir(location), path+".extends", extendedChain); err != nil {
      return err
    }
  }

  _, hasFilesSelector := obj["files"]
  files, err := parsePatternList(obj["files"], path+".files")
  if err != nil {
    return err
  }
  ignores, err := parsePatternList(obj["ignores"], path+".ignores")
  if err != nil {
    return err
  }

  // An `ignores` list without a `files` filter is a GLOBAL ignore: a config
  // file is a single ITtscLintConfig object, so its top-level `ignores` is
  // the only way an author can say "never lint these files". It must
  // therefore exclude the matched files from every entry of the resolved
  // chain — including entries folded in via `extends`, which otherwise
  // carry no ignores of their own and would keep linting the excluded
  // files (samchon/ttsc: `extends` + `ignores` + `rules` leaked the base
  // config's rules onto ignored paths). When `files` IS present the
  // ignores only refine that entry's selection, matching ESLint's
  // entry-scoped semantics, and no global entry is added.
  if len(files) == 0 && len(ignores) > 0 {
    store.entries = append(store.entries, ConfigEntry{
      BaseDir:    baseDir,
      Ignores:    ignores,
      IgnoreOnly: true,
    })
  }

  rulesValue, hasRules := obj["rules"]
  formatValue, hasFormat := obj["format"]
  if hasRules || hasFormat {
    // Expand the format block (if any) into a rules-shaped map, then
    // overlay the user's explicit `rules` entries. Formatter settings live
    // exclusively in the `format` block: any `format/*` key in `rules` is
    // dropped below (never activates, never overrides the format block), so
    // the overlay only ever layers lint-rule severities on top.
    var formatRulesRaw map[string]any
    if hasFormat {
      formatMap, ok := formatValue.(map[string]any)
      if !ok {
        return fmt.Errorf("@ttsc/lint: %s.format must be an object, got %T", path, formatValue)
      }
      expanded, err := expandFormatBlock(formatMap)
      if err != nil {
        return err
      }
      formatRulesRaw = expanded
    }
    var rulesMap map[string]any
    if hasRules {
      typedMap, ok := rulesValue.(map[string]any)
      if !ok {
        return fmt.Errorf("@ttsc/lint: %s.rules must be a rule severity map, got %T", path, rulesValue)
      }
      // `format/*` rules are configured exclusively through the `format`
      // block; they are never valid keys in `rules`. Silently drop any that
      // appear, the same way an unknown rule name is ignored (see
      // parseExternalRuleMapInto): a config must not carry a formatter
      // setting in two places, and a stray `format/*` here is simply not the
      // formatting surface, so it has no effect rather than erroring.
      rulesMap = typedMap
      for key := range rulesMap {
        if isFormatRuleName(key) {
          delete(rulesMap, key)
        }
      }
    }
    merged := mergeRuleMaps(formatRulesRaw, rulesMap)
    if len(merged) > 0 {
      parsed, entryOptions, err := parseExternalRuleMapInto(merged, path+".rules")
      if err != nil {
        return err
      }
      store.entries = append(store.entries, ConfigEntry{
        BaseDir:          baseDir,
        Files:            files,
        HasFilesSelector: hasFilesSelector,
        Ignores:          ignores,
        Rules:            parsed,
        Options:          entryOptions,
      })
    }
  }
  return nil
}

// parseExternalRuleMapInto parses one entry's rules and option tuples. Options
// stay on the ConfigEntry that owns their files/ignores scope; no project-wide
// mirror is created.
func parseExternalRuleMapInto(raw any, path string) (RuleConfig, RuleOptionsMap, error) {
  out := RuleConfig{}
  entryOptions := RuleOptionsMap{}
  if err := collectExternalRuleMapWithOptions(out, entryOptions, raw, path); err != nil {
    return nil, nil, err
  }
  return out, entryOptions, nil
}

// collectExternalRuleMapWithOptions also records the rule's option payload
// when the entry is a `[severity, ...options]` tuple. `opts` may be nil when
// the caller does not need option capture.
func collectExternalRuleMapWithOptions(out RuleConfig, opts RuleOptionsMap, raw any, path string) error {
  dict, ok := raw.(map[string]any)
  if !ok {
    return fmt.Errorf("@ttsc/lint: %s must be a rules object, got %T", path, raw)
  }
  for name, value := range dict {
    sev, ruleOpts, err := parseExternalRuleEntry(value)
    if err != nil {
      return fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    canonical := normalizeBuiltinRuleName(name)
    out[canonical] = sev
    if opts != nil && len(ruleOpts) > 0 {
      opts[canonical] = ruleOpts
    }
  }
  return nil
}

// rejectUnknownConfigKeys surfaces typos in top-level config-file keys at the
// boundary rather than silently ignoring them. The key set mirrors
// `ITtscLintConfig` exactly.
func rejectUnknownConfigKeys(value map[string]any, path string) error {
  allowed := map[string]struct{}{
    "files":   {},
    "ignores": {},
    "extends": {},
    "plugins": {},
    "rules":   {},
    "format":  {},
  }
  for key := range value {
    if _, ok := allowed[key]; !ok {
      return fmt.Errorf("@ttsc/lint: %s has unknown key %q; a lint config file must be an ITtscLintConfig object (files, ignores, extends, plugins, rules, format)", path, key)
    }
  }
  return nil
}

// parsePatternList coerces a raw config value to a string slice for use as a
// `files` or `ignores` pattern list. Accepts a bare string (single-pattern
// shorthand) or a string array. Empty patterns are rejected eagerly.
func parsePatternList(raw any, path string) ([]string, error) {
  if raw == nil {
    return nil, nil
  }
  switch typed := raw.(type) {
  case string:
    if strings.TrimSpace(typed) == "" {
      return nil, fmt.Errorf("@ttsc/lint: %s must not contain an empty pattern", path)
    }
    return []string{typed}, nil
  case []any:
    out := make([]string, 0, len(typed))
    for i, item := range typed {
      pattern, ok := item.(string)
      if !ok {
        return nil, fmt.Errorf("@ttsc/lint: %s[%d] must be a string, got %T", path, i, item)
      }
      if strings.TrimSpace(pattern) == "" {
        return nil, fmt.Errorf("@ttsc/lint: %s[%d] must not be empty", path, i)
      }
      out = append(out, pattern)
    }
    return out, nil
  default:
    return nil, fmt.Errorf("@ttsc/lint: %s must be a string or string array, got %T", path, raw)
  }
}

// LoadRuleConfig resolves the lint config for one plugin entry and flattens it
// to a plain RuleConfig (no glob scoping). Used by callers and tests that only
// need a project-wide severity map.
func LoadRuleConfig(entry *PluginEntry, cwd, tsconfigPath string) (RuleConfig, error) {
  resolver, err := LoadConfigResolver(entry, cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  switch typed := resolver.(type) {
  case RuleConfig:
    return typed, nil
  case *ConfigStore:
    return typed.Flatten(), nil
  default:
    return resolver.EnabledRuleConfig(), nil
  }
}

// LoadConfigResolver resolves one plugin entry into the engine-facing config
// model.
//
// The tsconfig plugin entry carries exactly one optional lint-specific key:
// `configFile`, a path (relative to the tsconfig directory, or absolute) to
// the lint config file. When `configFile` is set, that file is loaded; when it
// is absent, a `lint.config.*` / `ttsc-lint.config.*` file is discovered by
// walking upward from the tsconfig directory.
//
// All rules, format options, and contributor plugins live in the config file
// itself — the tsconfig entry has no inline rule/format/plugin surface.
func LoadConfigResolver(entry *PluginEntry, cwd, tsconfigPath string) (RuleResolver, error) {
  if entry == nil {
    return RuleConfig{}, nil
  }
  inline := entry.Config
  if inline == nil {
    inline = map[string]any{}
  }
  resolutionRoot := tsconfigBaseDir(cwd, tsconfigPath)

  if configFileValue, ok := inline["configFile"]; ok {
    configFile, ok := configFileValue.(string)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must be a string path, got %T", configFileValue)
    }
    if strings.TrimSpace(configFile) == "" {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must not be empty")
    }
    location := resolveConfigFilePath(configFile, cwd, tsconfigPath)
    return loadConfigResolver(location, resolutionRoot)
  }

  discovered, err := findLintConfigFile(cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  if discovered == "" {
    return nil, fmt.Errorf(
      "%w (searched upward from %s); create one or set \"configFile\" on the tsconfig plugin entry",
      errNoLintConfigFile,
      strings.Join(discoveryConfigBaseDirs(cwd, tsconfigPath), ", then from "),
    )
  }
  return loadConfigResolver(discovered, resolutionRoot)
}

// loadConfigResolver loads and parses the lint config file at `location` into
// a *ConfigStore and returns it as a RuleResolver.
func loadConfigResolver(
  location string,
  resolutionRoot string,
) (RuleResolver, error) {
  evaluated, err := loadConfigFileEvaluationWithin(location, resolutionRoot)
  if err != nil {
    return nil, err
  }
  store, err := collectConfigStoreWithin(
    evaluated.value,
    filepath.Dir(location),
    location,
    resolutionRoot,
  )
  if err != nil {
    return nil, err
  }
  appendConfigPaths(store, evaluated.dependencies)
  appendConfigDirectories(store, evaluated.dependencyDirectories)
  return store, nil
}

func appendConfigPaths(store *ConfigStore, paths []string) {
  for _, location := range paths {
    location = filepath.Clean(location)
    if !containsPath(store.paths, location) {
      store.paths = append(store.paths, location)
    }
  }
  sort.Strings(store.paths)
}

func appendConfigDirectories(store *ConfigStore, directories []string) {
  for _, location := range directories {
    location = filepath.Clean(location)
    if !containsPath(store.directories, location) {
      store.directories = append(store.directories, location)
    }
  }
  sort.Strings(store.directories)
}

func findLintConfigFile(cwd, tsconfigPath string) (string, error) {
  for _, origin := range discoveryConfigBaseDirs(cwd, tsconfigPath) {
    discovered, err := findLintConfigFileFrom(origin)
    if err != nil {
      return "", err
    }
    if discovered != "" {
      return discovered, nil
    }
  }
  return "", nil
}

// findLintConfigFileFrom walks upward from `dir` and returns the first
// directory level holding exactly one lint config file. Two or more candidates
// in the same directory is ambiguous and a hard error; an exhausted walk
// returns "" so the caller can try the next discovery origin.
func findLintConfigFileFrom(dir string) (string, error) {
  for {
    matches := make([]string, 0, 1)
    for _, name := range []string{
      "lint.config.json",
      "lint.config.js",
      "lint.config.mjs",
      "lint.config.cjs",
      "lint.config.ts",
      "lint.config.mts",
      "lint.config.cts",
      "ttsc-lint.config.json",
      "ttsc-lint.config.js",
      "ttsc-lint.config.mjs",
      "ttsc-lint.config.cjs",
      "ttsc-lint.config.ts",
      "ttsc-lint.config.mts",
      "ttsc-lint.config.cts",
    } {
      candidate := filepath.Join(dir, name)
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        matches = append(matches, candidate)
      }
    }
    if len(matches) > 1 {
      names := make([]string, 0, len(matches))
      for _, m := range matches {
        names = append(names, filepath.Base(m))
      }
      return "", fmt.Errorf("@ttsc/lint: multiple lint config files found in %s (%s); set \"configFile\" explicitly", dir, strings.Join(names, ", "))
    }
    if len(matches) == 1 {
      return matches[0], nil
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return "", nil
    }
    dir = parent
  }
}

// pluginConfigDirEnv mirrors driver.PluginConfigDirEnv from
// `packages/ttsc/driver`: the environment variable through which the ttsc
// launcher passes the project root that plugin config-file discovery and
// relative "configFile" resolution anchor at. It matters when the compiled
// tsconfig is a generated wrapper outside the project (e.g. @ttsc/unplugin's
// compiler-options overlay in the system temp directory) — the tsconfig
// directory then no longer identifies the project. The constant is inlined
// here instead of imported because @ttsc/lint deliberately avoids a
// dependency on the in-tree ttsc module (see host.go).
const pluginConfigDirEnv = "TTSC_PLUGIN_CONFIG_DIR"

// explicitPluginConfigDir returns the launcher-provided config anchor from
// pluginConfigDirEnv, resolved against cwd, or "" when the channel is unset.
func explicitPluginConfigDir(cwd string) string {
  dir := strings.TrimSpace(os.Getenv(pluginConfigDirEnv))
  if dir == "" {
    return ""
  }
  if !filepath.IsAbs(dir) && cwd != "" {
    dir = filepath.Join(cwd, dir)
  }
  return filepath.Clean(dir)
}

// resolveConfigFilePath resolves a user-supplied config path to an absolute
// path. Absolute paths are returned unchanged; relative paths are joined to the
// tsconfig directory (or cwd when no tsconfig is set).
func resolveConfigFilePath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

// discoveryConfigBaseDirs returns the ordered directories from which
// auto-discovery walks upward when no explicit config path is provided. The
// launcher's explicit project-root channel (pluginConfigDirEnv) is the single
// origin when set: it names the real project even when the tsconfig is a
// generated wrapper in a temp directory, and keeps the wrapper's temp-tree
// ancestry out of the walk. Otherwise the tsconfig directory comes first so
// that nested package configs are found relative to the tsconfig that
// triggered the lint run; the working directory follows as a fallback so a
// caller that points at an out-of-tree tsconfig still discovers the project's
// lint config instead of failing on the tsconfig dir's empty ancestry.
func discoveryConfigBaseDirs(cwd, tsconfigPath string) []string {
  if explicit := explicitPluginConfigDir(cwd); explicit != "" {
    return []string{explicit}
  }
  origins := make([]string, 0, 2)
  if tsconfigPath != "" {
    resolvedTsconfig := tsconfigPath
    if !filepath.IsAbs(resolvedTsconfig) {
      resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
    }
    origins = append(origins, filepath.Dir(resolvedTsconfig))
  }
  if cwd != "" && !containsPath(origins, cwd) {
    origins = append(origins, filepath.Clean(cwd))
  }
  return origins
}

// containsPath reports whether `paths` already holds `candidate` after
// cleaning, comparing case-insensitively on Windows (where two spellings of
// the same directory differ only by drive-letter or path case).
func containsPath(paths []string, candidate string) bool {
  cleaned := filepath.Clean(candidate)
  for _, existing := range paths {
    if existing == cleaned {
      return true
    }
    if runtime.GOOS == "windows" && strings.EqualFold(existing, cleaned) {
      return true
    }
  }
  return false
}

// tsconfigBaseDir returns the base directory for relative config paths
// supplied in the tsconfig plugin entry. The launcher's explicit project-root
// channel (pluginConfigDirEnv) wins when set — the tsconfig may be a
// generated wrapper in a temp directory that no longer identifies the
// project — otherwise the directory containing the tsconfig is used, falling
// back to cwd when tsconfigPath is empty.
func tsconfigBaseDir(cwd, tsconfigPath string) string {
  if explicit := explicitPluginConfigDir(cwd); explicit != "" {
    return explicit
  }
  if tsconfigPath == "" {
    return cwd
  }
  resolvedTsconfig := tsconfigPath
  if !filepath.IsAbs(resolvedTsconfig) {
    resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
  }
  return filepath.Dir(resolvedTsconfig)
}

// loadConfigFile loads and deserializes a lint config file at `location`.
// The file format is determined by extension: .json is parsed natively;
// .js/.cjs/.mjs run through a Node subprocess; .ts/.cts/.mts run through ttsx.
// The two subprocess-backed forms go through loadCachedConfigFile so that a
// monorepo build — which spawns one `ttsc` process per package — evaluates a
// shared lint config once instead of once per package.
func loadConfigFile(location string) (any, error) {
  evaluated, err := loadConfigFileEvaluation(location)
  return evaluated.value, err
}

type configDependencyFingerprint struct {
  Path   string `json:"path"`
  Digest string `json:"digest"`
  Kind   string `json:"kind"`
  Scope  string `json:"scope"`
}

const (
  configDependencyCache        = "cache"
  configDependencyWatch        = "watch"
  configDependencyFile         = "file"
  configDependencyDir          = "directory"
  configDependencyOptionalFile = "optional-file"
)

type evaluatedConfigFile struct {
  value                 any
  dependencies          []string
  dependencyDirectories []string
  dependencyDigests     []configDependencyFingerprint
  dependenciesTracked   bool
}

type cachedConfigEvaluation struct {
  Value               any                           `json:"value"`
  Dependencies        []configDependencyFingerprint `json:"dependencies"`
  DependenciesTracked bool                          `json:"dependenciesTracked"`
}

func loadConfigFileEvaluation(location string) (evaluatedConfigFile, error) {
  return loadConfigFileEvaluationWithin(location, filepath.Dir(location))
}

func loadConfigFileEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  if strings.TrimSpace(resolutionRoot) == "" {
    resolutionRoot = filepath.Dir(location)
  }
  if absolute, err := filepath.Abs(resolutionRoot); err == nil {
    resolutionRoot = absolute
  }
  resolutionRoot = filepath.Clean(resolutionRoot)
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    value, err := loadJSONConfigFile(location)
    return evaluatedConfigFile{value: value}, err
  case ".js", ".cjs", ".mjs":
    return loadCachedConfigEvaluationForRoot(
      location,
      resolutionRoot,
      func(location string) (evaluatedConfigFile, error) {
        return loadScriptConfigEvaluationWithin(location, resolutionRoot)
      },
    )
  case ".ts", ".cts", ".mts":
    return loadCachedConfigEvaluationForRoot(
      location,
      resolutionRoot,
      func(location string) (evaluatedConfigFile, error) {
        return loadTypeScriptConfigEvaluationWithin(location, resolutionRoot)
      },
    )
  default:
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: unsupported config file extension %q for %s", ext, location)
  }
}

// configCacheVersion namespaces the on-disk config cache. Bump it whenever
// the shape of a cached config object changes so that entries written by an
// older @ttsc/lint binary are treated as a miss rather than silently reused.
const configCacheVersion = "v5"

// configEvalCache memoizes evaluated .ts/.js lint config objects for the
// lifetime of one process; the on-disk cache (configCacheDir) extends the
// same memoization across the separate `ttsc` processes a monorepo build
// spawns. Guarded by configEvalCacheMu.
var (
  configEvalCacheMu sync.Mutex
  configEvalCache   = map[string]cachedConfigEvaluation{}
)

// configCacheDir is the directory shared by this Go sidecar and the JS
// plugin factory (packages/lint/src/index.ts) for cached lint configs.
// Evaluating a .ts/.js config means spawning a ttsx/node subprocess; the
// cache keeps every `ttsc` invocation after the first from re-paying it.
func configCacheDir() string {
  return filepath.Join(os.TempDir(), "ttsc-lint-config-cache")
}

// configCacheDisabled reports whether the env opt-out is set — an escape
// hatch for configs whose behavior depends on state outside their local module
// graph, such as environment variables, network responses, or arbitrary file
// reads.
func configCacheDisabled() bool {
  return os.Getenv("TTSC_LINT_DISABLE_CONFIG_CACHE") != ""
}

// configCacheKey derives the cache key for a config file from a version
// tag, a namespace `kind`, the file's absolute path, and its exact
// contents. Content-addressing means an edited config invalidates cleanly
// with no clock-resolution race; the absolute path keeps two projects with
// byte-identical configs distinct; `kind` separates this sidecar's
// evaluated-config namespace from the JS factory's plugin-entry namespace.
func configCacheKey(kind, absPath string, content []byte) string {
  h := sha256.New()
  h.Write([]byte(configCacheVersion))
  h.Write([]byte{0})
  h.Write([]byte(kind))
  h.Write([]byte{0})
  h.Write([]byte(absPath))
  h.Write([]byte{0})
  h.Write(content)
  return hex.EncodeToString(h.Sum(nil))
}

// loadCachedConfigFile preserves the historical value-only test seam around
// the two-tier (in-process + on-disk) cache. Production executable-config
// loaders use loadCachedConfigEvaluation so their complete local module graph
// participates in validation. Errors are never cached: a failed evaluation
// re-runs next time.
func loadCachedConfigFile(location string, eval func(string) (any, error)) (any, error) {
  evaluated, err := loadCachedConfigEvaluationWithPolicy(
    location,
    func(location string) (evaluatedConfigFile, error) {
      value, err := eval(location)
      return evaluatedConfigFile{value: value}, err
    },
    false,
    "",
  )
  return evaluated.value, err
}

func loadCachedConfigEvaluation(
  location string,
  eval func(string) (evaluatedConfigFile, error),
) (evaluatedConfigFile, error) {
  return loadCachedConfigEvaluationWithPolicy(location, eval, true, "")
}

func loadCachedConfigEvaluationForRoot(
  location string,
  resolutionRoot string,
  eval func(string) (evaluatedConfigFile, error),
) (evaluatedConfigFile, error) {
  return loadCachedConfigEvaluationWithPolicy(
    location,
    eval,
    true,
    filepath.Clean(resolutionRoot),
  )
}

func loadCachedConfigEvaluationWithPolicy(
  location string,
  eval func(string) (evaluatedConfigFile, error),
  dependenciesRequired bool,
  cacheNamespace string,
) (evaluatedConfigFile, error) {
  if configCacheDisabled() {
    return eval(location)
  }
  content, err := os.ReadFile(location)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
  }
  abs := location
  if resolved, absErr := filepath.Abs(location); absErr == nil {
    abs = resolved
  }
  kind := "config-value"
  if dependenciesRequired {
    kind = "config-graph"
  }
  if cacheNamespace != "" {
    kind += "\x00" + cacheNamespace
  }
  key := configCacheKey(kind, abs, content)

  configEvalCacheMu.Lock()
  cached, ok := configEvalCache[key]
  configEvalCacheMu.Unlock()
  if ok &&
    cached.DependenciesTracked == dependenciesRequired &&
    cachedConfigEvaluationIsCurrent(cached) {
    return evaluatedConfigFileFromCache(cached), nil
  }
  if disk, hit := readConfigDiskCache(key); hit &&
    disk.DependenciesTracked == dependenciesRequired &&
    cachedConfigEvaluationIsCurrent(disk) {
    configEvalCacheMu.Lock()
    configEvalCache[key] = disk
    configEvalCacheMu.Unlock()
    return evaluatedConfigFileFromCache(disk), nil
  }

  var evaluated evaluatedConfigFile
  for attempt := 0; attempt < 3; attempt++ {
    evaluated, err = eval(location)
    if err != nil {
      return evaluatedConfigFile{}, err
    }
    if evaluated.dependenciesTracked != dependenciesRequired {
      return evaluatedConfigFile{}, fmt.Errorf(
        "@ttsc/lint: config evaluator for %s returned dependenciesTracked=%t, want %t",
        location,
        evaluated.dependenciesTracked,
        dependenciesRequired,
      )
    }
    if (!evaluated.dependenciesTracked ||
      len(evaluated.dependencyDigests) != 0) &&
      configDependencyDigestsAreCurrent(evaluated.dependencyDigests) {
      cached = cachedConfigEvaluation{
        Value:               evaluated.value,
        Dependencies:        append([]configDependencyFingerprint(nil), evaluated.dependencyDigests...),
        DependenciesTracked: evaluated.dependenciesTracked,
      }
      configEvalCacheMu.Lock()
      configEvalCache[key] = cached
      configEvalCacheMu.Unlock()
      writeConfigDiskCache(key, cached)
      return evaluated, nil
    }
  }
  return evaluated, nil
}

// readConfigDiskCache returns the cached config object for `key`, or
// (nil, false) on any miss — a missing file, an unreadable file, or
// content that no longer parses as a config object. Every failure is a
// soft miss: the caller re-evaluates rather than surfacing a cache fault.
func evaluatedConfigFileFromCache(cached cachedConfigEvaluation) evaluatedConfigFile {
  dependencies := make([]string, 0, len(cached.Dependencies))
  directories := make([]string, 0, len(cached.Dependencies))
  for _, dependency := range cached.Dependencies {
    if dependency.Scope == configDependencyWatch {
      if dependency.Kind == configDependencyDir {
        directories = append(directories, dependency.Path)
      } else {
        dependencies = append(dependencies, dependency.Path)
      }
    }
  }
  return evaluatedConfigFile{
    value:                 cached.Value,
    dependencies:          dependencies,
    dependencyDirectories: directories,
    dependencyDigests:     append([]configDependencyFingerprint(nil), cached.Dependencies...),
    dependenciesTracked:   cached.DependenciesTracked,
  }
}

func configDependencyDigestsAreCurrent(
  dependencies []configDependencyFingerprint,
) bool {
  for _, dependency := range dependencies {
    digest, err := configDependencyDigest(dependency)
    if err != nil {
      return false
    }
    if digest != dependency.Digest {
      return false
    }
  }
  return true
}

func configDependencyDigest(
  dependency configDependencyFingerprint,
) (string, error) {
  if dependency.Kind == configDependencyDir {
    entries, err := os.ReadDir(dependency.Path)
    if err != nil {
      return "", err
    }
    h := sha256.New()
    for index, entry := range entries {
      kind := "other"
      info, err := entry.Info()
      if err != nil {
        return "", err
      }
      switch {
      case info.Mode()&os.ModeSymlink != 0:
        kind = "symlink"
      case info.IsDir():
        kind = "directory"
      case info.Mode().IsRegular():
        kind = "file"
      }
      target := ""
      if kind == "symlink" {
        target, err = os.Readlink(filepath.Join(dependency.Path, entry.Name()))
        if err != nil {
          target = "<unreadable>"
        }
      }
      h.Write([]byte(entry.Name()))
      h.Write([]byte{0})
      h.Write([]byte(kind))
      h.Write([]byte{0})
      h.Write([]byte(target))
      if index+1 != len(entries) {
        h.Write([]byte{0})
      }
    }
    return hex.EncodeToString(h.Sum(nil)), nil
  }
  if dependency.Kind == configDependencyOptionalFile {
    info, err := os.Stat(dependency.Path)
    if err != nil || !info.Mode().IsRegular() {
      digest := sha256.Sum256([]byte("missing\x00"))
      return hex.EncodeToString(digest[:]), nil
    }
    body, err := os.ReadFile(dependency.Path)
    if err != nil {
      digest := sha256.Sum256([]byte("missing\x00"))
      return hex.EncodeToString(digest[:]), nil
    }
    h := sha256.New()
    h.Write([]byte("file\x00"))
    h.Write(body)
    return hex.EncodeToString(h.Sum(nil)), nil
  }
  body, err := os.ReadFile(dependency.Path)
  if err != nil {
    return "", err
  }
  digest := sha256.Sum256(body)
  return hex.EncodeToString(digest[:]), nil
}

func cachedConfigEvaluationIsCurrent(cached cachedConfigEvaluation) bool {
  if !cached.DependenciesTracked {
    return len(cached.Dependencies) == 0
  }
  normalized, ok := normalizeConfigDependencyFingerprints(cached.Dependencies)
  return ok && configDependencyDigestsAreCurrent(normalized)
}

func readConfigDiskCache(key string) (cachedConfigEvaluation, bool) {
  body, err := os.ReadFile(filepath.Join(configCacheDir(), key+".json"))
  if err != nil {
    return cachedConfigEvaluation{}, false
  }
  var cached cachedConfigEvaluation
  if err := json.Unmarshal(body, &cached); err != nil {
    return cachedConfigEvaluation{}, false
  }
  if !isConfigObject(cached.Value) {
    return cachedConfigEvaluation{}, false
  }
  if cached.DependenciesTracked {
    normalized, ok := normalizeConfigDependencyFingerprints(cached.Dependencies)
    if !ok {
      return cachedConfigEvaluation{}, false
    }
    cached.Dependencies = normalized
  } else if len(cached.Dependencies) != 0 {
    return cachedConfigEvaluation{}, false
  }
  return cached, true
}

// writeConfigDiskCache stores `value` under `key`. It is best-effort: a
// failure to create the directory or write the file leaves the cache cold
// (the next run re-evaluates) rather than failing the lint run. The write
// goes through a temp file + rename so a concurrent reader in a sibling
// `ttsc` process never observes a half-written entry.
func writeConfigDiskCache(key string, cached cachedConfigEvaluation) {
  body, err := json.Marshal(cached)
  if err != nil {
    return
  }
  dir := configCacheDir()
  if err := os.MkdirAll(dir, 0o755); err != nil {
    return
  }
  tmp, err := os.CreateTemp(dir, key+".*.tmp")
  if err != nil {
    return
  }
  tmpName := tmp.Name()
  if _, err := tmp.Write(body); err != nil {
    tmp.Close()
    os.Remove(tmpName)
    return
  }
  if err := tmp.Close(); err != nil {
    os.Remove(tmpName)
    return
  }
  if err := os.Rename(tmpName, filepath.Join(dir, key+".json")); err != nil {
    os.Remove(tmpName)
  }
}

// loadJSONConfigFile reads and JSON-parses a lint config file. A leading UTF-8
// BOM is stripped before parsing so files saved by Windows editors are accepted.
func loadJSONConfigFile(location string) (any, error) {
  body, err := os.ReadFile(location)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
  }
  // Strip a leading UTF-8 BOM so files saved by Windows editors round
  // trip through `json.Unmarshal` without an opaque "invalid character"
  // failure. Mirrors the equivalent JS-side guard in
  // `packages/lint/src/index.ts::readJsonConfigPlugins`.
  body = bytes.TrimPrefix(body, []byte{0xEF, 0xBB, 0xBF})
  var out any
  if err := json.Unmarshal(body, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: parse config file %s: %w", location, err)
  }
  if !isConfigObject(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  return out, nil
}

// serializableConfigKeys is the single source of truth for the ITtscLintConfig
// keys that survive the JSON round trip from a config-loader subprocess back to
// the Go sidecar. Both the .js/.cjs/.mjs loader (loadScriptConfigFile) and the
// .ts/.cts/.mts loader (typeScriptConfigLoaderSource) splice this list into the
// `toSerializableConfig` key whitelist of their generated scripts, so the set
// of copied keys is defined here once rather than duplicated per loader.
var serializableConfigKeys = []string{"files", "ignores", "extends", "plugins", "rules", "format"}

// serializableConfigKeysLiteral renders serializableConfigKeys as a
// JS/TS array literal (e.g. `"files", "ignores", ...`) for splicing into the
// generated loader scripts' `toSerializableConfig` whitelist.
func serializableConfigKeysLiteral() string {
  quoted := make([]string, len(serializableConfigKeys))
  for i, key := range serializableConfigKeys {
    quoted[i] = fmt.Sprintf("%q", key)
  }
  return strings.Join(quoted, ", ")
}

// runConfigLoaderCommand runs a prepared config-loader subprocess (`cmd`),
// then turns its result into a parsed config object. It owns the shared tail
// of both subprocess-backed loaders: discarding user stdout, distinguishing a
// timeout from a process error, reading the private result file, JSON-parsing
// its envelope, and rejecting a non-object result. `ctx` is the
// timeout context the caller bound `cmd` to; `location` is the config file path
// for error messages; `label` is the human-readable subject (e.g. "config
// file" or "TypeScript config file") spliced into the load/parse error
// prefixes so each loader keeps its own wording.
func runConfigLoaderCommand(
  ctx context.Context,
  cmd *exec.Cmd,
  location string,
  label string,
  outputPath string,
) (evaluatedConfigFile, error) {
  var stderr bytes.Buffer
  cmd.Stdout = io.Discard
  cmd.Stderr = &stderr
  err := cmd.Run()
  // A loader diagnostic is only useful when the load succeeds, because a
  // failure already carries the same text in its message. Forward it so an
  // assertion about what the loader recorded can name what it resolved.
  if os.Getenv("TTSC_LINT_DEBUG_CONFIG_GRAPH") != "" {
    if text := strings.TrimSpace(stderr.String()); text != "" {
      fmt.Fprintln(os.Stderr, text)
    }
  }
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: load %s %s: timed out after %s", label, location, configLoaderTimeout)
    }
    stderrText := strings.TrimSpace(stderr.String())
    if stderrText != "" {
      return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: load %s %s: %s", label, location, stderrText)
    }
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: load %s %s: %w", label, location, err)
  }
  output, err := os.ReadFile(outputPath)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: read %s %s result: %w", label, location, err)
  }
  var envelope struct {
    Dependencies []configDependencyFingerprint `json:"dependencies"`
    Value        any                           `json:"value"`
  }
  if err := json.Unmarshal(output, &envelope); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: parse %s %s output: %w", label, location, err)
  }
  if !isConfigObject(envelope.Value) {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  normalized, ok := normalizeConfigDependencyFingerprints(envelope.Dependencies)
  if !ok {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: %s %s returned malformed dependency fingerprints", label, location)
  }
  dependencies := make([]string, 0, len(normalized))
  directories := make([]string, 0, len(normalized))
  for _, dependency := range normalized {
    if dependency.Scope == configDependencyWatch {
      if dependency.Kind == configDependencyDir {
        directories = append(directories, dependency.Path)
      } else {
        dependencies = append(dependencies, dependency.Path)
      }
    }
  }
  return evaluatedConfigFile{
    value:                 envelope.Value,
    dependencies:          dependencies,
    dependencyDirectories: directories,
    dependencyDigests:     normalized,
    dependenciesTracked:   true,
  }, nil
}

func normalizeConfigDependencyFingerprints(
  input []configDependencyFingerprint,
) ([]configDependencyFingerprint, bool) {
  if len(input) == 0 {
    return nil, false
  }
  seen := make(map[string]configDependencyFingerprint, len(input))
  normalized := make([]configDependencyFingerprint, 0, len(input))
  for _, dependency := range input {
    if strings.TrimSpace(dependency.Path) == "" ||
      !filepath.IsAbs(dependency.Path) ||
      len(dependency.Digest) != sha256.Size*2 ||
      strings.ToLower(dependency.Digest) != dependency.Digest ||
      (dependency.Kind != configDependencyFile &&
        dependency.Kind != configDependencyDir &&
        dependency.Kind != configDependencyOptionalFile) ||
      (dependency.Scope != configDependencyCache &&
        dependency.Scope != configDependencyWatch) {
      return nil, false
    }
    if _, err := hex.DecodeString(dependency.Digest); err != nil {
      return nil, false
    }
    absolute := filepath.Clean(dependency.Path)
    key := dependency.Kind + "\x00" + absolute
    if previous, exists := seen[key]; exists {
      if previous.Digest != dependency.Digest ||
        previous.Kind != dependency.Kind ||
        previous.Scope != dependency.Scope {
        return nil, false
      }
      continue
    }
    fingerprint := configDependencyFingerprint{
      Path:   absolute,
      Digest: dependency.Digest,
      Kind:   dependency.Kind,
      Scope:  dependency.Scope,
    }
    seen[key] = fingerprint
    normalized = append(normalized, fingerprint)
  }
  sort.Slice(normalized, func(left, right int) bool {
    return normalized[left].Path < normalized[right].Path
  })
  return normalized, true
}

// loadScriptConfigFile evaluates a .js/.cjs/.mjs config file by running a
// Node subprocess that dynamic-imports the file, resolves the exported config
// through the same 8-hop default/config normalization used by the TS loader,
// and serializes the result into a private result file. The subprocess has a
// configLoaderTimeout deadline to prevent user code from hanging indefinitely.
func loadScriptConfigFile(location string) (any, error) {
  evaluated, err := loadScriptConfigEvaluation(location)
  return evaluated.value, err
}

func loadScriptConfigEvaluation(location string) (evaluatedConfigFile, error) {
  return loadScriptConfigEvaluationWithin(location, filepath.Dir(location))
}

func loadScriptConfigEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  tempDir, err := os.MkdirTemp("", "ttsc-lint-script-config-")
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: create script config result directory: %w", err)
  }
  defer os.RemoveAll(tempDir)
  outputPath := filepath.Join(tempDir, "result.json")
  script := scriptConfigLoaderSource()
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  ctx, cancel := context.WithTimeout(context.Background(), configLoaderTimeout)
  defer cancel()
  cmd := exec.CommandContext(
    ctx,
    node,
    "-e",
    script,
    location,
    outputPath,
    resolutionRoot,
  )
  return runConfigLoaderCommand(ctx, cmd, location, "config file", outputPath)
}

// scriptConfigLoaderSource returns the CommonJS source of the loader script
// Node executes to evaluate a .js/.cjs/.mjs lint config file. It is a named
// function for the same reason as typeScriptConfigLoaderSource: the source is
// a fmt.Sprintf format string, so every literal percent sign inside it must be
// doubled, and only a callable generator lets a regression prove the emitted
// script carries no formatting artifact.
func scriptConfigLoaderSource() string {
  return fmt.Sprintf(`
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const CONFIG_KEYS = new Set([%s]);
const configUrl = pathToFileURL(process.argv[1]).href;
const outputPath = process.argv[2];
const resolutionRoot = path.resolve(process.argv[3]);
const dependencies = new Map();
const graphNodes = new Map();
const graphEdges = [];
const configLocation = fileURLToPath(configUrl);
graphNodes.set(configUrl, configLocation);
recordDependency(
  "file",
  configLocation,
  createHash("sha256").update(fs.readFileSync(configLocation)).digest("hex"),
  [configUrl],
);
recordPackageManifests(configLocation, [configUrl]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (typeof resolved.url !== "string" || !resolved.url.startsWith("file:")) {
      return resolved;
    }
    const url = new URL(resolved.url).href;
    const parent = context.parentURL && new URL(context.parentURL).href;
    const location = fileURLToPath(url);
    // The entry is recognized by identity, not by string. A module URL is
    // assigned by whoever loaded it, so the config can come back under a
    // different spelling of the same file than the one this process was handed
    // — a Windows short component, or a symlinked ancestor. Comparing strings
    // then rejects the config's own imports at this gate, because their parent
    // is a URL no node was ever recorded under, and the whole dependency graph
    // collapses to the records made before the first import.
    const entry =
      url === configUrl || samePhysicalPath(location, configLocation);
    if (!entry && (parent === undefined || !graphNodes.has(parent))) {
      return resolved;
    }
    graphNodes.set(url, location);
    if (parent !== undefined) {
      graphEdges.push({
        child: url,
        packageBoundary:
          pathHasNodeModules(location) && !isLocalModuleSpecifier(specifier),
        parent,
      });
      recordResolutionTopology(
        specifier,
        parent,
        url,
        location,
        context.conditions,
      );
    }
    try {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        [url],
      );
    } catch {
      recordDependency("file", location, "", [url]);
    }
    return resolved;
  },
});

(async () => {
  try {
    const mod = await import(configUrl);
    const value = await resolveConfig(mod, true);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("config file must export an ITtscLintConfig object");
    }
    fs.writeFileSync(outputPath, JSON.stringify({
      dependencies: finalizeDependencies(),
      value: toSerializableConfig(value),
    }), "utf8");
  } finally {
    hooks.deregister();
  }
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

async function resolveConfig(value, allowNamedConfig) {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (typeof current === "function") {
      current = await current();
      allowNamedConfig = false;
      continue;
    }
    if (current !== null && typeof current === "object" && !Array.isArray(current)) {
      if (Object.prototype.hasOwnProperty.call(current, "default")) {
        const defaultValue = current.default;
        if (isModuleNamespace(current) || !hasConfigKey(current)) {
          current = defaultValue;
          allowNamedConfig = false;
          continue;
        }
        const normalizedDefault = await resolveConfig(defaultValue, false);
        if (normalizedDefault !== null && typeof normalizedDefault === "object" && !Array.isArray(normalizedDefault)) {
          current = mergeConfigObjects(normalizedDefault, current);
          allowNamedConfig = false;
          continue;
        }
      }
      if (allowNamedConfig && Object.prototype.hasOwnProperty.call(current, "config")) {
        current = current.config;
        allowNamedConfig = false;
        continue;
      }
    }
    break;
  }
  return current;
}

function isModuleNamespace(value) {
  return Object.prototype.toString.call(value) === "[object Module]";
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function recordDependency(kind, location, digest, owners) {
  const key = kind + "\0" + location;
  const previous = dependencies.get(key);
  const mergedOwners = previous ? previous.owners : new Set();
  for (const owner of owners) mergedOwners.add(owner);
  dependencies.set(key, {
    digest: previous && previous.digest !== digest ? "" : digest,
    kind,
    owners: mergedOwners,
    path: location,
  });
}

function isLocalModuleSpecifier(specifier) {
  return specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(specifier);
}

function pathHasNodeModules(location) {
  return location.replaceAll("\\", "/").split("/").includes("node_modules");
}

function recordResolutionTopology(
  specifier,
  parentUrl,
  childUrl,
  childLocation,
  conditions,
) {
  const owners = [parentUrl, childUrl];
  const parentLocation = graphNodes.get(parentUrl);
  if (parentLocation !== undefined && isLocalModuleSpecifier(specifier)) {
    recordDirectoryDependency(path.dirname(parentLocation), owners);
  }
  recordDirectoryDependency(path.dirname(childLocation), owners);
  recordPackageManifests(childLocation, owners);
  if (parentLocation !== undefined && !isLocalModuleSpecifier(specifier)) {
    recordNodeModulesSearchDirectories(
      parentLocation,
      specifier,
      childLocation,
      owners,
      conditions,
    );
  }
}

function recordDirectoryDependency(location, owners) {
  try {
    recordDependency("directory", location, directoryDigest(location), owners);
  } catch {
    recordDependency("directory", location, "", owners);
  }
}

function directoryDigest(location) {
  const entries = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(Buffer.from(entry.name), entry, target));
    }
  } else {
    for (const entry of fs.readdirSync(
      location,
      { encoding: "buffer", withFileTypes: true },
    )) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function directoryDigestRecord(name, entry, target) {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function optionalFileDigest(location) {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]))
        .digest("hex");
    }
  } catch {
  }
  return createHash("sha256").update("missing\0").digest("hex");
}

function recordOptionalFileDependency(location, owners) {
  try {
    if (fs.statSync(location).isFile()) {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        owners,
      );
      return true;
    }
  } catch {
  }
  recordDependency("optional-file", location, optionalFileDigest(location), owners);
  return false;
}

function recordPackageManifests(location, owners) {
  let current = path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (recordOptionalFileDependency(manifest, owners)) return;
    const parent = path.dirname(current);
    if (parent === current || path.basename(current) === "node_modules") return;
    current = parent;
  }
}

function recordNodeModulesSearchDirectories(
  parentLocation,
  specifier,
  childLocation,
  owners,
  conditions,
) {
  const packageName = modulePackageName(specifier);
  const scope =
    specifier.startsWith("@") && specifier.includes("/")
      ? specifier.slice(0, specifier.indexOf("/"))
      : undefined;
  let current = path.dirname(parentLocation);
  while (true) {
    recordDirectoryDependency(current, owners);
    const modules = path.join(current, "node_modules");
    try {
      if (fs.statSync(modules).isDirectory()) {
        recordDirectoryDependency(modules, owners);
        if (scope !== undefined) {
          const scoped = path.join(modules, scope);
          try {
            if (fs.statSync(scoped).isDirectory()) {
              recordDirectoryDependency(scoped, owners);
            }
          } catch {
          }
        }
        if (packageName !== undefined) {
          const selected = recordPackageCandidateTopology(
            modules,
            packageName,
            specifier,
            childLocation,
            owners,
            conditions,
          );
          if (
            selected ||
            resolvedPackageContains(modules, packageName, childLocation)
          ) {
            return;
          }
        }
      }
    } catch {
    }
    if (
      packageName === undefined &&
      samePhysicalPath(current, resolutionRoot)
    ) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function recordPackageCandidateTopology(
  modules,
  packageName,
  specifier,
  childLocation,
  owners,
  conditions,
) {
  const packageRoot = path.join(modules, packageName);
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return false;
  } catch {
    return false;
  }
  const subpath = specifier
    .slice(packageName.length)
    .replace(/^[/\\]+/, "");
  const rootTopology = recordPackageRootTopology(
    packageRoot,
    owners,
    subpath === "",
    subpath === "" ? "." : "./" + subpath.replaceAll("\\", "/"),
    childLocation,
    conditions,
  );
  if (subpath !== "" && !rootTopology.hasExports) {
    return (
      recordPackageSubpathTopology(
        packageRoot,
        subpath,
        childLocation,
        owners,
      ) || rootTopology.selected
    );
  }
  return rootTopology.selected;
}

function recordPackageRootTopology(
  packageRoot,
  owners,
  useMain,
  packageSubpath,
  childLocation,
  conditions,
) {
  const normalizedRoot = path.resolve(packageRoot);
  const manifest = path.join(normalizedRoot, "package.json");
  const legacySelected = () =>
    useMain &&
    packagePathCandidateMatchesChild(normalizedRoot, childLocation, true);
  if (!recordOptionalFileDependency(manifest, owners)) {
    const selected = legacySelected();
    if (!selected) {
      recordPackageIndexCandidates(normalizedRoot, useMain, owners);
    }
    return { hasExports: false, selected };
  }
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const hasExports =
        value.exports !== undefined && value.exports !== null;
      if (hasExports) {
        const target = selectPackageExportsTarget(
          value.exports,
          packageSubpath,
          new Set(conditions),
        );
        const candidate =
          typeof target === "string"
            ? packageExportsTarget(normalizedRoot, target)
            : undefined;
        const selected =
          candidate !== undefined &&
          packagePathCandidateMatchesChild(
            candidate,
            childLocation,
            false,
          );
        if (selected) {
          recordPackagePathCandidate(candidate, owners);
        } else if (candidate !== undefined) {
          // A nearer package the search skipped starts winning the moment its
          // own active target appears, and neither the parent node_modules
          // listing nor the manifest changes when only that file is created.
          recordOptionalFileDependency(candidate, owners);
        }
        return { hasExports: true, selected };
      }
      let selected = legacySelected();
      if (useMain && typeof value.main === "string") {
        const main = path.resolve(normalizedRoot, value.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
      if (!selected) {
        recordPackageIndexCandidates(normalizedRoot, useMain, owners);
      }
      return { hasExports: false, selected };
    }
  } catch {
  }
  const rootSelected = legacySelected();
  if (!rootSelected) {
    recordPackageIndexCandidates(normalizedRoot, useMain, owners);
  }
  return { hasExports: false, selected: rootSelected };
}

// recordPackageIndexCandidates pins the LOAD_INDEX fallbacks of a package root
// this resolution walked past without selecting. An empty package directory, or
// one whose manifest declares no usable entry, becomes resolvable as soon as one
// of these files exists, and that creation changes neither the parent directory
// listing nor the manifest digest already recorded for the candidate.
function recordPackageIndexCandidates(packageRoot, useMain, owners) {
  if (!useMain) return;
  for (const name of ["index.js", "index.json", "index.node"]) {
    recordOptionalFileDependency(path.join(packageRoot, name), owners);
  }
}

function selectPackageExportsTarget(
  exportsValue,
  packageSubpath,
  conditions,
) {
  let mappings = exportsValue;
  if (
    typeof mappings === "string" ||
    Array.isArray(mappings) ||
    (isObject(mappings) &&
      Object.keys(mappings).every((key) => !key.startsWith(".")))
  ) {
    if (packageSubpath !== ".") return undefined;
    return selectPackageTarget(mappings, "", false, conditions);
  }
  if (!isObject(mappings)) return undefined;
  if (
    Object.prototype.hasOwnProperty.call(mappings, packageSubpath) &&
    !packageSubpath.includes("*") &&
    !packageSubpath.endsWith("/")
  ) {
    return selectPackageTarget(
      mappings[packageSubpath],
      "",
      false,
      conditions,
    );
  }
  let bestMatch = "";
  let bestSubpath = "";
  for (const key of Object.keys(mappings)) {
    const wildcard = key.indexOf("*");
    if (
      wildcard === -1 ||
      key.lastIndexOf("*") !== wildcard ||
      !packageSubpath.startsWith(key.slice(0, wildcard))
    ) {
      continue;
    }
    const trailer = key.slice(wildcard + 1);
    if (
      packageSubpath.length < key.length ||
      !packageSubpath.endsWith(trailer) ||
      packagePatternKeyCompare(bestMatch, key) !== 1
    ) {
      continue;
    }
    bestMatch = key;
    bestSubpath = packageSubpath.slice(
      wildcard,
      packageSubpath.length - trailer.length,
    );
  }
  return bestMatch === ""
    ? undefined
    : selectPackageTarget(
        mappings[bestMatch],
        bestSubpath,
        true,
        conditions,
      );
}

function selectPackageTarget(target, subpath, pattern, conditions) {
  if (typeof target === "string") {
    const selected = pattern ? target.replaceAll("*", subpath) : target;
    return validPackageExportsTarget(selected) ? selected : undefined;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = selectPackageTarget(
        item,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined && selected !== null) return selected;
    }
    return null;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const selected = selectPackageTarget(
        value,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined) return selected;
    }
    return undefined;
  }
  return target === null ? null : undefined;
}

function packagePatternKeyCompare(left, right) {
  const leftWildcard = left.indexOf("*");
  const rightWildcard = right.indexOf("*");
  const leftBase =
    leftWildcard === -1 ? left.length : leftWildcard + 1;
  const rightBase =
    rightWildcard === -1 ? right.length : rightWildcard + 1;
  if (leftBase > rightBase) return -1;
  if (rightBase > leftBase) return 1;
  if (leftWildcard === -1) return 1;
  if (rightWildcard === -1) return -1;
  if (left.length > right.length) return -1;
  if (right.length > left.length) return 1;
  return 0;
}

function packageExportsTarget(packageRoot, target) {
  if (!validPackageExportsTarget(target)) return undefined;
  try {
    // Node resolves an exports target as a URL against the package manifest,
    // so percent escapes, query strings, and fragments all take part in the
    // path it finally loads. Joining the raw target by hand diverges from that
    // whenever the target is anything but a plain relative path, and a target
    // Node resolves while this model rejects loses the selected file's
    // fingerprint, leaving a retargeted symlink cached as fresh.
    const packageUrl = pathToFileURL(path.join(packageRoot, "package.json"));
    const resolved = new URL(target, packageUrl);
    const packagePath = new URL(".", packageUrl).pathname;
    if (!resolved.pathname.startsWith(packagePath)) return undefined;
    return fileURLToPath(resolved);
  } catch {
    return undefined;
  }
}

function validPackageExportsTarget(target) {
  if (!target.startsWith("./") || /%%2f|%%5c/i.test(target)) return false;
  const components = target
    .slice(2)
    .replaceAll("\\", "/")
    .split("/");
  if (
    components.some(
      (component) => {
        try {
          const decoded = decodeURIComponent(component);
          return (
            decoded === "." ||
            decoded === ".." ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            decoded.toLowerCase() === "node_modules"
          );
        } catch {
          return true;
        }
      },
    )
  ) {
    return false;
  }
  return true;
}

function packagePathCandidateMatchesChild(
  candidate,
  childLocation,
  legacy,
) {
  let child;
  try {
    child = fs.realpathSync.native(childLocation);
  } catch {
    child = path.resolve(childLocation);
  }
  const candidates = legacy
    ? [
        candidate,
        candidate + ".js",
        candidate + ".json",
        candidate + ".node",
        path.join(candidate, "index.js"),
        path.join(candidate, "index.json"),
        path.join(candidate, "index.node"),
      ]
    : [candidate];
  return candidates.some((location) => {
    try {
      return sameResolutionPath(fs.realpathSync.native(location), child);
    } catch {
      return false;
    }
  });
}

function recordPackageSubpathTopology(
  packageRoot,
  subpath,
  childLocation,
  owners,
) {
  const candidate = boundedPackageTarget(packageRoot, subpath);
  if (candidate === undefined) return false;
  recordPackagePathCandidate(candidate, owners);
  let selected = packagePathCandidateMatchesChild(
    candidate,
    childLocation,
    true,
  );
  try {
    if (!fs.statSync(candidate).isDirectory()) return selected;
  } catch {
    return selected;
  }
  const manifest = path.join(candidate, "package.json");
  if (!recordOptionalFileDependency(manifest, owners)) return selected;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      if (typeof value.main === "string") {
        const main = path.resolve(candidate, value.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
    }
  } catch {
  }
  return selected;
}

function boundedPackageTarget(
  packageRoot,
  target,
) {
  const candidate = path.resolve(packageRoot, target);
  const relative = path.relative(packageRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return candidate;
}

function recordPackagePathCandidate(
  candidate,
  owners,
  visited = new Set(),
  depth = 0,
) {
  const normalized = path.resolve(candidate);
  // The depth bound owns termination. A platform-wide case fold would merge
  // paths that differ only by case, which a per-directory case-sensitive
  // Windows tree keeps distinct, and would truncate a valid symlink chain.
  if (depth >= 64 || visited.has(normalized)) return;
  visited.add(normalized);
  const parsed = path.parse(normalized);
  const components = normalized
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const next = path.join(current, component);
    let entry;
    try {
      entry = fs.lstatSync(next);
    } catch {
      recordDirectoryDependency(current, owners);
      return;
    }
    if (entry.isSymbolicLink()) {
      recordDirectoryDependency(current, owners);
      try {
        const target = fs.readlinkSync(next);
        const remainder = components.slice(index + 1);
        recordPackagePathCandidate(
          path.join(path.resolve(current, target), ...remainder),
          owners,
          visited,
          depth + 1,
        );
      } catch {
      }
    }
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(next).isDirectory();
      } catch {
        return;
      }
    }
    if (index === components.length - 1) {
      recordDirectoryDependency(isDirectory ? next : current, owners);
      return;
    }
    if (!isDirectory) {
      recordDirectoryDependency(current, owners);
      return;
    }
    current = next;
  }
  recordDirectoryDependency(current, owners);
}

function modulePackageName(specifier) {
  if (specifier.startsWith("@")) {
    const components = specifier.split("/");
    return components.length >= 2
      ? components[0] + "/" + components[1]
      : undefined;
  }
  const [name] = specifier.split("/");
  return name && !name.startsWith("#") ? name : undefined;
}

function resolvedPackageContains(modules, packageName, childLocation) {
  try {
    const packageRoot = fs.realpathSync(path.join(modules, packageName));
    const relative = path.relative(
      packageRoot,
      fs.realpathSync(childLocation),
    );
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative))
    );
  } catch {
    return false;
  }
}

function sameResolutionPath(left, right) {
  return path.relative(left, right) === "";
}

function samePhysicalPath(left, right) {
  try {
    return sameResolutionPath(realPath(left), realPath(right));
  } catch {
    // A path that cannot be resolved cannot be shown to be the same file, and
    // answering from the lexical spelling would return the very answer this
    // comparison exists to replace.
    return false;
  }
}

function realPath(location) {
  return fs.realpathSync.native
    ? fs.realpathSync.native(location)
    : fs.realpathSync(location);
}

function finalizeDependencies() {
  const watched = graphWatchReachability();
  return [...dependencies.values()].map(({ owners, ...dependency }) => ({
    ...dependency,
    scope: [...owners].some((owner) => watched.has(owner))
      ? "watch"
      : "cache",
  }));
}

function graphWatchReachability() {
  const adjacency = new Map();
  for (const edge of graphEdges) {
    const outgoing = adjacency.get(edge.parent) || [];
    outgoing.push(edge);
    adjacency.set(edge.parent, outgoing);
  }
  const queue = [{ url: configUrl, watched: true }];
  const visited = new Set();
  const watched = new Set();
  while (queue.length !== 0) {
    const state = queue.shift();
    const key = state.url + "\0" + (state.watched ? "1" : "0");
    if (visited.has(key)) continue;
    visited.add(key);
    if (state.watched) watched.add(state.url);
    for (const edge of adjacency.get(state.url) || []) {
      const childLocation = graphNodes.get(edge.child);
      const childWatched = edge.packageBoundary
        ? false
        : childLocation !== undefined && !pathHasNodeModules(childLocation)
          ? true
          : state.watched;
      queue.push({ url: edge.child, watched: childWatched });
    }
  }
  return watched;
}

function hasConfigKey(value) {
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return true;
    }
  }
  return false;
}

function mergeConfigObjects(base, override) {
  const out = toSerializableConfig(base);
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      out[key] = override[key];
    }
  }
  return out;
}

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is `+"`"+`format`+"`"+` is not silently dropped.
function toSerializableConfig(value) {
  const out = {};
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`, serializableConfigKeysLiteral())
}

// loadTypeScriptConfigFile evaluates a .ts/.cts/.mts config file by writing
// an ephemeral loader script and tsconfig into a temp directory, symlinking the
// nearest node_modules, then running `ttsx` with a configLoaderTimeout deadline.
// The loader script imports the config file, resolves it through the same
// normalization chain used by loadScriptConfigFile, and writes a private JSON
// result file so user stdout cannot corrupt the protocol.
func loadTypeScriptConfigFile(location string) (any, error) {
  evaluated, err := loadTypeScriptConfigEvaluation(location)
  return evaluated.value, err
}

func loadTypeScriptConfigEvaluation(location string) (evaluatedConfigFile, error) {
  return loadTypeScriptConfigEvaluationWithin(location, filepath.Dir(location))
}

func loadTypeScriptConfigEvaluationWithin(
  location string,
  resolutionRoot string,
) (evaluatedConfigFile, error) {
  tempDir, err := os.MkdirTemp(loaderTempBase(location, os.TempDir()), "ttsc-lint-config-")
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: create config loader tempdir: %w", err)
  }
  tempDir = realpathIfPossible(tempDir)
  defer os.RemoveAll(tempDir)

  if err := linkNearestNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return evaluatedConfigFile{}, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  outputPath := filepath.Join(tempDir, "result.json")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importLiteral, err := json.Marshal(fileURL(location))
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: encode config import %s: %w", location, err)
  }
  outputLiteral, err := json.Marshal(outputPath)
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: encode config result path %s: %w", outputPath, err)
  }
  resolutionRootLiteral, err := json.Marshal(filepath.Clean(resolutionRoot))
  if err != nil {
    return evaluatedConfigFile{}, fmt.Errorf(
      "@ttsc/lint: encode config resolution root %s: %w",
      resolutionRoot,
      err,
    )
  }
  if err := os.WriteFile(
    loader,
    []byte(typeScriptConfigLoaderSource(
      string(importLiteral),
      string(outputLiteral),
      string(resolutionRootLiteral),
    )),
    0o644,
  ); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: write config loader: %w", err)
  }
  if err := os.WriteFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return evaluatedConfigFile{}, fmt.Errorf("@ttsc/lint: write config loader tsconfig: %w", err)
  }

  args := []string{
    "--project", tsconfig,
    "--cwd", tempDir,
    "--cache-dir", filepath.Join(tempDir, "cache"),
    // The loader only needs to type-check and execute the user's
    // `*.config.ts`; it must NOT load the host project's transform /
    // check plugins. Discovering them (`@nestia/core`, `typia`, …)
    // would run their project checks against this ephemeral loader
    // tsconfig — which is deliberately lenient (`strict: false`) — so a
    // plugin like `@nestia/core` that demands strict mode would fail
    // the build and abort config evaluation. `--no-plugins` makes the
    // ttsx build hermetic.
    "--no-plugins",
  }
  if tsgo := os.Getenv("TTSC_TSGO_BINARY"); tsgo != "" {
    args = append(args, "--binary", tsgo)
  }
  args = append(args, loader)

  ctx, cancel := context.WithTimeout(context.Background(), configLoaderTimeout)
  defer cancel()
  cmd := ttsxCommandContext(ctx, args...)
  cmd.Env = nodeConfigLoaderEnv(location)
  return runConfigLoaderCommand(ctx, cmd, location, "TypeScript config file", outputPath)
}

// isConfigObject reports whether `value` is a top-level config object. A lint
// config file always exports a single `ITtscLintConfig` object; arrays and
// scalars are rejected so users get a clear error instead of an opaque parse
// failure downstream.
func isConfigObject(value any) bool {
  _, ok := value.(map[string]any)
  return ok
}

func fileURL(location string) string {
  volume := filepath.VolumeName(location)
  if volume != "" {
    volumePath := filepath.ToSlash(volume)
    rest := strings.TrimPrefix(filepath.ToSlash(location[len(volume):]), "/")
    if strings.HasPrefix(volumePath, "//?/UNC") {
      return uncFileURL(rest)
    }
    if strings.HasPrefix(volumePath, "//?/") {
      pathname := "/" + strings.TrimPrefix(volumePath, "//?/")
      if rest != "" {
        pathname += "/" + rest
      }
      return (&url.URL{Scheme: "file", Path: pathname}).String()
    }
    if strings.HasPrefix(volumePath, "//") {
      return uncFileURL(strings.TrimPrefix(volumePath, "//") + "/" + rest)
    }
  }
  pathname := filepath.ToSlash(location)
  if volume != "" && !strings.HasPrefix(pathname, "/") {
    pathname = "/" + pathname
  }
  return (&url.URL{Scheme: "file", Path: pathname}).String()
}

func uncFileURL(pathname string) string {
  server, remainder, ok := strings.Cut(pathname, "/")
  if !ok || server == "" {
    return (&url.URL{Scheme: "file", Path: "/" + strings.TrimPrefix(pathname, "/")}).String()
  }
  share, tail, _ := strings.Cut(remainder, "/")
  if share == "" {
    return (&url.URL{Scheme: "file", Path: "/" + strings.TrimPrefix(pathname, "/")}).String()
  }
  urlPath := "/" + share
  if tail != "" {
    urlPath += "/" + tail
  }
  return (&url.URL{Scheme: "file", Host: server, Path: urlPath}).String()
}

// typeScriptConfigLoaderSource returns the TypeScript source of the ephemeral
// loader script that ttsx executes to evaluate a TypeScript lint config file.
// `importLiteral` is a JSON-encoded file URL (produced by json.Marshal). It is
// assigned to a variable before `import(configUrl)` so tsgo does not try to
// statically resolve the file URL during the loader build.
func typeScriptConfigLoaderSource(
  importLiteral string,
  outputLiteral string,
  resolutionRootLiteral string,
) string {
  return fmt.Sprintf(`// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as fs from "node:fs";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { Buffer } from "node:buffer";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { createHash } from "node:crypto";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { registerHooks } from "node:module";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import * as path from "node:path";
// @ts-ignore -- internal loader must not require user-installed Node typings.
import { fileURLToPath, pathToFileURL } from "node:url";

const configUrl = %s;
const outputPath = %s;
const resolutionRoot = path.resolve(%s);
const CONFIG_KEYS = new Set<string>([%s]);
const dependencies = new Map<string, {
  digest: string;
  kind: "directory" | "file" | "optional-file";
  path: string;
  owners: Set<string>;
}>();
const graphNodes = new Map<string, string>();
const graphEdges: Array<{
  child: string;
  packageBoundary: boolean;
  parent: string;
}> = [];
const normalizedConfigUrl = new URL(configUrl).href;
const configLocation = fileURLToPath(normalizedConfigUrl);
graphNodes.set(normalizedConfigUrl, configLocation);
recordDependency(
  "file",
  configLocation,
  createHash("sha256").update(fs.readFileSync(configLocation)).digest("hex"),
  [normalizedConfigUrl],
);
recordPackageManifests(configLocation, [normalizedConfigUrl]);

declare const process: {
  env: Record<string, string | undefined>;
  platform: string;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (typeof resolved.url !== "string" || !resolved.url.startsWith("file:")) {
      return resolved;
    }
    const url = new URL(resolved.url).href;
    const parent = context.parentURL && new URL(context.parentURL).href;
    const location = fileURLToPath(url);
    // The entry is recognized by identity, not by string. A module URL is
    // assigned by whoever loaded it, so the config can come back under a
    // different spelling of the same file than the one this process was handed
    // — a Windows short component, or a symlinked ancestor. Comparing strings
    // then rejects the config's own imports at this gate, because their parent
    // is a URL no node was ever recorded under, and the whole dependency graph
    // collapses to the records made before the first import.
    const entry =
      url === new URL(configUrl).href || samePhysicalPath(location, configLocation);
    if (!entry && (parent === undefined || !graphNodes.has(parent))) {
      return resolved;
    }
    graphNodes.set(url, location);
    if (parent !== undefined) {
      graphEdges.push({
        child: url,
        packageBoundary:
          pathHasNodeModules(location) && !isLocalModuleSpecifier(specifier),
        parent,
      });
      recordResolutionTopology(
        specifier,
        parent,
        url,
        location,
        context.conditions,
      );
    }
    try {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        [url],
      );
    } catch {
      recordDependency("file", location, "", [url]);
    }
    return resolved;
  },
});

try {
  const importedConfig = await import(configUrl);
  const value = await resolveConfig(importedConfig, true);
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("config file must export an ITtscLintConfig object");
  }
  fs.writeFileSync(outputPath, JSON.stringify({
    dependencies: finalizeDependencies(),
    value: toSerializableConfig(value),
  }), "utf8");
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
} finally {
  hooks.deregister();
}

async function resolveConfig(value: unknown, allowNamedConfig: boolean): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (typeof current === "function") {
      current = await (current as () => unknown | Promise<unknown>)();
      allowNamedConfig = false;
      continue;
    }
    if (isObject(current) && !Array.isArray(current)) {
      if (hasOwn(current, "default")) {
        const defaultValue = current.default;
        if (isModuleNamespace(current) || !hasConfigKey(current)) {
          current = defaultValue;
          allowNamedConfig = false;
          continue;
        }
        const normalizedDefault = await resolveConfig(defaultValue, false);
        if (isObject(normalizedDefault) && !Array.isArray(normalizedDefault)) {
          current = mergeConfigObjects(normalizedDefault, current);
          allowNamedConfig = false;
          continue;
        }
      }
      if (allowNamedConfig && hasOwn(current, "config")) {
        current = current.config;
        allowNamedConfig = false;
        continue;
      }
    }
    break;
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function recordDependency(
  kind: "directory" | "file" | "optional-file",
  location: string,
  digest: string,
  owners: readonly string[],
): void {
  const key = kind + "\0" + location;
  const previous = dependencies.get(key);
  const mergedOwners = previous?.owners ?? new Set<string>();
  for (const owner of owners) mergedOwners.add(owner);
  dependencies.set(key, {
    digest: previous !== undefined && previous.digest !== digest ? "" : digest,
    kind,
    owners: mergedOwners,
    path: location,
  });
}

function isLocalModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(specifier);
}

function pathHasNodeModules(location: string): boolean {
  return location.replaceAll("\\", "/").split("/").includes("node_modules");
}

function recordResolutionTopology(
  specifier: string,
  parentUrl: string,
  childUrl: string,
  childLocation: string,
  conditions: readonly string[],
): void {
  const owners = [parentUrl, childUrl];
  const parentLocation = graphNodes.get(parentUrl);
  if (parentLocation !== undefined && isLocalModuleSpecifier(specifier)) {
    recordDirectoryDependency(path.dirname(parentLocation), owners);
  }
  recordDirectoryDependency(path.dirname(childLocation), owners);
  recordPackageManifests(childLocation, owners);
  if (parentLocation !== undefined && !isLocalModuleSpecifier(specifier)) {
    recordNodeModulesSearchDirectories(
      parentLocation,
      specifier,
      childLocation,
      owners,
      conditions,
    );
  }
}

function recordDirectoryDependency(
  location: string,
  owners: readonly string[],
): void {
  try {
    recordDependency("directory", location, directoryDigest(location), owners);
  } catch {
    recordDependency("directory", location, "", owners);
  }
}

function directoryDigest(location: string): string {
  const entries: Buffer[] = [];
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = Buffer.from(
            fs.readlinkSync(path.join(location, entry.name)),
            "utf8",
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(Buffer.from(entry.name), entry, target));
    }
  } else {
    for (const entry of fs.readdirSync(location, {
      encoding: "buffer",
      withFileTypes: true,
    })) {
      let target = Buffer.alloc(0);
      if (entry.isSymbolicLink()) {
        try {
          target = fs.readlinkSync(
            Buffer.concat([
              Buffer.from(location),
              Buffer.from(path.sep),
              entry.name,
            ]),
            { encoding: "buffer" },
          );
        } catch {
          target = Buffer.from("<unreadable>");
        }
      }
      entries.push(directoryDigestRecord(entry.name, entry, target));
    }
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function directoryDigestRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function optionalFileDigest(location: string): string {
  try {
    if (fs.statSync(location).isFile()) {
      return createHash("sha256")
        .update(Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]))
        .digest("hex");
    }
  } catch {
  }
  return createHash("sha256").update("missing\0").digest("hex");
}

function recordOptionalFileDependency(
  location: string,
  owners: readonly string[],
): boolean {
  try {
    if (fs.statSync(location).isFile()) {
      recordDependency(
        "file",
        location,
        createHash("sha256").update(fs.readFileSync(location)).digest("hex"),
        owners,
      );
      return true;
    }
  } catch {
  }
  recordDependency("optional-file", location, optionalFileDigest(location), owners);
  return false;
}

function recordPackageManifests(
  location: string,
  owners: readonly string[],
): void {
  let current = path.dirname(location);
  while (true) {
    const manifest = path.join(current, "package.json");
    if (recordOptionalFileDependency(manifest, owners)) return;
    const parent = path.dirname(current);
    if (parent === current || path.basename(current) === "node_modules") return;
    current = parent;
  }
}

function recordNodeModulesSearchDirectories(
  parentLocation: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): void {
  const packageName = modulePackageName(specifier);
  const scope =
    specifier.startsWith("@") && specifier.includes("/")
      ? specifier.slice(0, specifier.indexOf("/"))
      : undefined;
  let current = path.dirname(parentLocation);
  while (true) {
    recordDirectoryDependency(current, owners);
    const modules = path.join(current, "node_modules");
    try {
      if (fs.statSync(modules).isDirectory()) {
        recordDirectoryDependency(modules, owners);
        if (scope !== undefined) {
          const scoped = path.join(modules, scope);
          try {
            if (fs.statSync(scoped).isDirectory()) {
              recordDirectoryDependency(scoped, owners);
            }
          } catch {
          }
        }
        if (packageName !== undefined) {
          const selected = recordPackageCandidateTopology(
            modules,
            packageName,
            specifier,
            childLocation,
            owners,
            conditions,
          );
          if (
            selected ||
            resolvedPackageContains(modules, packageName, childLocation)
          ) {
            return;
          }
        }
      }
    } catch {
    }
    if (
      packageName === undefined &&
      samePhysicalPath(current, resolutionRoot)
    ) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function recordPackageCandidateTopology(
  modules: string,
  packageName: string,
  specifier: string,
  childLocation: string,
  owners: readonly string[],
  conditions: readonly string[],
): boolean {
  const packageRoot = path.join(modules, packageName);
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return false;
  } catch {
    return false;
  }
  const subpath = specifier
    .slice(packageName.length)
    .replace(/^[/\\]+/, "");
  const rootTopology = recordPackageRootTopology(
    packageRoot,
    owners,
    subpath === "",
    subpath === "" ? "." : "./" + subpath.replaceAll("\\", "/"),
    childLocation,
    conditions,
  );
  if (subpath !== "" && !rootTopology.hasExports) {
    return (
      recordPackageSubpathTopology(
        packageRoot,
        subpath,
        childLocation,
        owners,
      ) || rootTopology.selected
    );
  }
  return rootTopology.selected;
}

function recordPackageRootTopology(
  packageRoot: string,
  owners: readonly string[],
  useMain: boolean,
  packageSubpath: string,
  childLocation: string,
  conditions: readonly string[],
): { hasExports: boolean; selected: boolean } {
  const normalizedRoot = path.resolve(packageRoot);
  const manifest = path.join(normalizedRoot, "package.json");
  const legacySelected = (): boolean =>
    useMain &&
    packagePathCandidateMatchesChild(normalizedRoot, childLocation, true);
  if (!recordOptionalFileDependency(manifest, owners)) {
    const selected = legacySelected();
    if (!selected) {
      recordPackageIndexCandidates(normalizedRoot, useMain, owners);
    }
    return { hasExports: false, selected };
  }
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      const hasExports =
        metadata.exports !== undefined && metadata.exports !== null;
      if (hasExports) {
        const target = selectPackageExportsTarget(
          metadata.exports,
          packageSubpath,
          new Set(conditions),
        );
        const candidate =
          typeof target === "string"
            ? packageExportsTarget(normalizedRoot, target)
            : undefined;
        const selected =
          candidate !== undefined &&
          packagePathCandidateMatchesChild(
            candidate,
            childLocation,
            false,
          );
        if (selected) {
          recordPackagePathCandidate(candidate, owners);
        } else if (candidate !== undefined) {
          // A nearer package the search skipped starts winning the moment its
          // own active target appears, and neither the parent node_modules
          // listing nor the manifest changes when only that file is created.
          recordOptionalFileDependency(candidate, owners);
        }
        return { hasExports: true, selected };
      }
      let selected = legacySelected();
      if (useMain && typeof metadata.main === "string") {
        const main = path.resolve(normalizedRoot, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
      if (!selected) {
        recordPackageIndexCandidates(normalizedRoot, useMain, owners);
      }
      return { hasExports: false, selected };
    }
  } catch {
  }
  const rootSelected = legacySelected();
  if (!rootSelected) {
    recordPackageIndexCandidates(normalizedRoot, useMain, owners);
  }
  return { hasExports: false, selected: rootSelected };
}

// recordPackageIndexCandidates pins the LOAD_INDEX fallbacks of a package root
// this resolution walked past without selecting. An empty package directory, or
// one whose manifest declares no usable entry, becomes resolvable as soon as one
// of these files exists, and that creation changes neither the parent directory
// listing nor the manifest digest already recorded for the candidate.
function recordPackageIndexCandidates(
  packageRoot: string,
  useMain: boolean,
  owners: readonly string[],
): void {
  if (!useMain) return;
  for (const name of ["index.js", "index.json", "index.node"]) {
    recordOptionalFileDependency(path.join(packageRoot, name), owners);
  }
}

function selectPackageExportsTarget(
  exportsValue: unknown,
  packageSubpath: string,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  let mappings: unknown = exportsValue;
  if (
    typeof mappings === "string" ||
    Array.isArray(mappings) ||
    (isObject(mappings) &&
      Object.keys(mappings).every((key) => !key.startsWith(".")))
  ) {
    if (packageSubpath !== ".") return undefined;
    return selectPackageTarget(mappings, "", false, conditions);
  }
  if (!isObject(mappings)) return undefined;
  if (
    Object.prototype.hasOwnProperty.call(mappings, packageSubpath) &&
    !packageSubpath.includes("*") &&
    !packageSubpath.endsWith("/")
  ) {
    return selectPackageTarget(
      mappings[packageSubpath],
      "",
      false,
      conditions,
    );
  }
  let bestMatch = "";
  let bestSubpath = "";
  for (const key of Object.keys(mappings)) {
    const wildcard = key.indexOf("*");
    if (
      wildcard === -1 ||
      key.lastIndexOf("*") !== wildcard ||
      !packageSubpath.startsWith(key.slice(0, wildcard))
    ) {
      continue;
    }
    const trailer = key.slice(wildcard + 1);
    if (
      packageSubpath.length < key.length ||
      !packageSubpath.endsWith(trailer) ||
      packagePatternKeyCompare(bestMatch, key) !== 1
    ) {
      continue;
    }
    bestMatch = key;
    bestSubpath = packageSubpath.slice(
      wildcard,
      packageSubpath.length - trailer.length,
    );
  }
  return bestMatch === ""
    ? undefined
    : selectPackageTarget(
        mappings[bestMatch],
        bestSubpath,
        true,
        conditions,
      );
}

function selectPackageTarget(
  target: unknown,
  subpath: string,
  pattern: boolean,
  conditions: ReadonlySet<string>,
): string | null | undefined {
  if (typeof target === "string") {
    const selected = pattern ? target.replaceAll("*", subpath) : target;
    return validPackageExportsTarget(selected) ? selected : undefined;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const selected = selectPackageTarget(
        item,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined && selected !== null) return selected;
    }
    return null;
  }
  if (isObject(target)) {
    for (const [condition, value] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const selected = selectPackageTarget(
        value,
        subpath,
        pattern,
        conditions,
      );
      if (selected !== undefined) return selected;
    }
    return undefined;
  }
  return target === null ? null : undefined;
}

function packagePatternKeyCompare(left: string, right: string): number {
  const leftWildcard = left.indexOf("*");
  const rightWildcard = right.indexOf("*");
  const leftBase =
    leftWildcard === -1 ? left.length : leftWildcard + 1;
  const rightBase =
    rightWildcard === -1 ? right.length : rightWildcard + 1;
  if (leftBase > rightBase) return -1;
  if (rightBase > leftBase) return 1;
  if (leftWildcard === -1) return 1;
  if (rightWildcard === -1) return -1;
  if (left.length > right.length) return -1;
  if (right.length > left.length) return 1;
  return 0;
}

function packageExportsTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  if (!validPackageExportsTarget(target)) return undefined;
  try {
    // Node resolves an exports target as a URL against the package manifest,
    // so percent escapes, query strings, and fragments all take part in the
    // path it finally loads. Joining the raw target by hand diverges from that
    // whenever the target is anything but a plain relative path, and a target
    // Node resolves while this model rejects loses the selected file's
    // fingerprint, leaving a retargeted symlink cached as fresh.
    const packageUrl = pathToFileURL(path.join(packageRoot, "package.json"));
    const resolved = new URL(target, packageUrl);
    const packagePath = new URL(".", packageUrl).pathname;
    if (!resolved.pathname.startsWith(packagePath)) return undefined;
    return fileURLToPath(resolved);
  } catch {
    return undefined;
  }
}

function validPackageExportsTarget(target: string): boolean {
  if (!target.startsWith("./") || /%%2f|%%5c/i.test(target)) return false;
  const components = target
    .slice(2)
    .replaceAll("\\", "/")
    .split("/");
  if (
    components.some(
      (component) => {
        try {
          const decoded = decodeURIComponent(component);
          return (
            decoded === "." ||
            decoded === ".." ||
            decoded.includes("/") ||
            decoded.includes("\\") ||
            decoded.toLowerCase() === "node_modules"
          );
        } catch {
          return true;
        }
      },
    )
  ) {
    return false;
  }
  return true;
}

function packagePathCandidateMatchesChild(
  candidate: string,
  childLocation: string,
  legacy: boolean,
): boolean {
  let child: string;
  try {
    child = fs.realpathSync.native(childLocation);
  } catch {
    child = path.resolve(childLocation);
  }
  const candidates = legacy
    ? [
        candidate,
        candidate + ".js",
        candidate + ".json",
        candidate + ".node",
        path.join(candidate, "index.js"),
        path.join(candidate, "index.json"),
        path.join(candidate, "index.node"),
      ]
    : [candidate];
  return candidates.some((location) => {
    try {
      return sameResolutionPath(fs.realpathSync.native(location), child);
    } catch {
      return false;
    }
  });
}

function recordPackageSubpathTopology(
  packageRoot: string,
  subpath: string,
  childLocation: string,
  owners: readonly string[],
): boolean {
  const candidate = boundedPackageTarget(packageRoot, subpath);
  if (candidate === undefined) return false;
  recordPackagePathCandidate(candidate, owners);
  let selected = packagePathCandidateMatchesChild(
    candidate,
    childLocation,
    true,
  );
  try {
    if (!fs.statSync(candidate).isDirectory()) return selected;
  } catch {
    return selected;
  }
  const manifest = path.join(candidate, "package.json");
  if (!recordOptionalFileDependency(manifest, owners)) return selected;
  try {
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (value !== null && typeof value === "object") {
      const metadata = value as Record<string, unknown>;
      if (typeof metadata.main === "string") {
        const main = path.resolve(candidate, metadata.main);
        recordPackagePathCandidate(main, owners);
        selected =
          packagePathCandidateMatchesChild(main, childLocation, true) ||
          selected;
      }
    }
  } catch {
  }
  return selected;
}

function boundedPackageTarget(
  packageRoot: string,
  target: string,
): string | undefined {
  const candidate = path.resolve(packageRoot, target);
  const relative = path.relative(packageRoot, candidate);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return candidate;
}

function recordPackagePathCandidate(
  candidate: string,
  owners: readonly string[],
  visited: Set<string> = new Set(),
  depth = 0,
): void {
  const normalized = path.resolve(candidate);
  // The depth bound owns termination. A platform-wide case fold would merge
  // paths that differ only by case, which a per-directory case-sensitive
  // Windows tree keeps distinct, and would truncate a valid symlink chain.
  if (depth >= 64 || visited.has(normalized)) return;
  visited.add(normalized);
  const parsed = path.parse(normalized);
  const components = normalized
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const next = path.join(current, component);
    let entry: ReturnType<typeof fs.lstatSync>;
    try {
      entry = fs.lstatSync(next);
    } catch {
      recordDirectoryDependency(current, owners);
      return;
    }
    if (entry.isSymbolicLink()) {
      recordDirectoryDependency(current, owners);
      try {
        const target = fs.readlinkSync(next);
        const remainder = components.slice(index + 1);
        recordPackagePathCandidate(
          path.join(path.resolve(current, target), ...remainder),
          owners,
          visited,
          depth + 1,
        );
      } catch {
      }
    }
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(next).isDirectory();
      } catch {
        return;
      }
    }
    if (index === components.length - 1) {
      recordDirectoryDependency(isDirectory ? next : current, owners);
      return;
    }
    if (!isDirectory) {
      recordDirectoryDependency(current, owners);
      return;
    }
    current = next;
  }
  recordDirectoryDependency(current, owners);
}

function modulePackageName(specifier: string): string | undefined {
  if (specifier.startsWith("@")) {
    const components = specifier.split("/");
    return components.length >= 2
      ? components[0] + "/" + components[1]
      : undefined;
  }
  const [name] = specifier.split("/");
  return name && !name.startsWith("#") ? name : undefined;
}

function resolvedPackageContains(
  modules: string,
  packageName: string,
  childLocation: string,
): boolean {
  try {
    const packageRoot = fs.realpathSync(path.join(modules, packageName));
    const relative = path.relative(
      packageRoot,
      fs.realpathSync(childLocation),
    );
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative))
    );
  } catch {
    return false;
  }
}

function sameResolutionPath(left: string, right: string): boolean {
  return path.relative(left, right) === "";
}

function samePhysicalPath(left: string, right: string): boolean {
  try {
    return sameResolutionPath(realPath(left), realPath(right));
  } catch {
    // A path that cannot be resolved cannot be shown to be the same file, and
    // answering from the lexical spelling would return the very answer this
    // comparison exists to replace.
    return false;
  }
}

function realPath(location: string): string {
  return fs.realpathSync.native
    ? fs.realpathSync.native(location)
    : fs.realpathSync(location);
}

function finalizeDependencies(): Array<{
  digest: string;
  kind: "directory" | "file" | "optional-file";
  path: string;
  scope: "cache" | "watch";
}> {
  const watched = graphWatchReachability();
  // Opt-in diagnostics for a graph that comes back empty. The only channel this
  // loader may use is stderr, because the result travels through a private file
  // that user output must not corrupt; it stays silent unless a caller asks.
  if (process.env.TTSC_LINT_DEBUG_CONFIG_GRAPH) {
    process.stderr.write(
      "@ttsc/lint: config graph " +
        JSON.stringify({
          configUrl,
          normalizedConfigUrl,
          nodes: [...graphNodes.keys()],
          edges: graphEdges.map((edge) => edge.parent + " -> " + edge.child),
          watched: [...watched],
        }) +
        "\n",
    );
  }
  return [...dependencies.values()].map(({ owners, ...dependency }) => ({
    ...dependency,
    scope: [...owners].some((owner) => watched.has(owner))
      ? "watch"
      : "cache",
  }));
}

function graphWatchReachability(): Set<string> {
  const config = new URL(configUrl).href;
  const adjacency = new Map<string, typeof graphEdges>();
  for (const edge of graphEdges) {
    const outgoing = adjacency.get(edge.parent) ?? [];
    outgoing.push(edge);
    adjacency.set(edge.parent, outgoing);
  }
  const queue: Array<{ url: string; watched: boolean }> = [
    { url: config, watched: true },
  ];
  const visited = new Set<string>();
  const watched = new Set<string>();
  while (queue.length !== 0) {
    const state = queue.shift()!;
    const key = state.url + "\0" + (state.watched ? "1" : "0");
    if (visited.has(key)) continue;
    visited.add(key);
    if (state.watched) watched.add(state.url);
    for (const edge of adjacency.get(state.url) ?? []) {
      const childLocation = graphNodes.get(edge.child);
      const childWatched = edge.packageBoundary
        ? false
        : childLocation !== undefined && !pathHasNodeModules(childLocation)
          ? true
          : state.watched;
      queue.push({ url: edge.child, watched: childWatched });
    }
  }
  return watched;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isModuleNamespace(value: Record<string, unknown>): boolean {
  return Object.prototype.toString.call(value) === "[object Module]";
}

function hasConfigKey(value: Record<string, unknown>): boolean {
  for (const key of CONFIG_KEYS) {
    if (hasOwn(value, key)) {
      return true;
    }
  }
  return false;
}

function mergeConfigObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out = toSerializableConfig(base);
  for (const key of CONFIG_KEYS) {
    if (hasOwn(override, key)) {
      out[key] = override[key];
    }
  }
  return out;
}

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is "format" is not silently dropped.
function toSerializableConfig(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) {
    if (hasOwn(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`,
    importLiteral,
    outputLiteral,
    resolutionRootLiteral,
    serializableConfigKeysLiteral(),
  )
}

// typeScriptConfigLoaderTsconfig generates the JSON content of the ephemeral
// tsconfig that compiles the loader script. Settings mirror the JS-factory
// loader's lenient baseline so identical user configs evaluate the same way
// from both the JS and Go sides.
func typeScriptConfigLoaderTsconfig(loader, location, outDir string) string {
  // Mirror the JS-factory loader's lenient settings (see the matching
  // tsconfig synthesis in `packages/lint/src/index.ts::readTtsxConfigPlugins`).
  // Both sides evaluate the SAME user-authored lint config; without
  // matching strictness, a config that loads fine through the JS
  // factory could be rejected by the Go sidecar (or vice versa) on
  // identical input. The loader is extracting data, not validating
  // user code, so `strict: false` + `allowJs: true` + `noImplicitAny:
  // false` is the right baseline.
  content := map[string]any{
    "compilerOptions": map[string]any{
      "allowImportingTsExtensions":      true,
      "allowJs":                         true,
      "checkJs":                         false,
      "module":                          "ESNext",
      "moduleResolution":                "bundler",
      "noImplicitAny":                   false,
      "outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
      "rewriteRelativeImportExtensions": true,
      "rootDir":                         loaderRootDir(outDir),
      "skipLibCheck":                    true,
      "strict":                          false,
      "target":                          "ES2022",
    },
    "files": []string{
      filepath.ToSlash(loader),
      filepath.ToSlash(location),
    },
  }
  body, err := json.MarshalIndent(content, "", "  ")
  if err != nil {
    panic(err)
  }
  return string(body)
}

// loaderRootDir returns the widest rootDir that still contains the loader
// tsconfig's inputs: the volume root of the loader temp dir (`C:/` on
// Windows, `/` elsewhere). A literal "/" is not an ancestor of drive-letter
// paths, so tsgo rejects every input with TS6059 (#299). The temp dir is
// created on the same volume as the config file (see loaderTempBase), so its
// volume root spans both `files` entries.
func loaderRootDir(outDir string) string {
  vol := filepath.VolumeName(outDir)
  if vol == "" {
    return "/"
  }
  return filepath.ToSlash(vol + `\`)
}

// loaderTempBase picks the parent directory for the ephemeral config-loader
// tree. The system temp dir is the default, but when it sits on a different
// volume than the config file (Windows: TEMP on `C:`, project on `D:`) the
// loader cannot work from there — no single tsconfig rootDir spans two
// volumes and filepath.Rel cannot produce a relative import across drives
// (#305) — so the tree is created under the config's nearest
// node_modules/.cache instead, falling back to the config's own directory
// when no node_modules exists (or its .cache cannot be created): any location
// on the config's volume beats the system temp dir, which is guaranteed to
// fail. Returns "" (the os.MkdirTemp default) when the volumes already match.
func loaderTempBase(location, systemTemp string) string {
  // A relative location has no volume; "" must not be read as "a volume
  // other than the system temp's" — it keeps the historical default (and
  // the Rel-failure contract for relative config paths).
  vol := filepath.VolumeName(location)
  if vol == "" || strings.EqualFold(filepath.VolumeName(systemTemp), vol) {
    return ""
  }
  nodeModules := findNearestNodeModules(filepath.Dir(location))
  if nodeModules == "" {
    return filepath.Dir(location)
  }
  // Resolve a linked node_modules (junction/symlink — common in managed
  // setups) before descending into it: the ESM runtime realpaths the loader
  // module at import time, and a relative config specifier computed from the
  // link-form path would resolve against the wrong directory. NTFS junctions
  // defeat filepath.EvalSymlinks, so the link component is chased by hand
  // first. Realpathing may also land on another volume, which defeats the
  // whole point — fall back to the config's directory then.
  base := filepath.Join(resolveDirLink(nodeModules), ".cache")
  if err := os.MkdirAll(base, 0o755); err != nil {
    return filepath.Dir(location)
  }
  real, err := filepath.EvalSymlinks(base)
  if err != nil || !strings.EqualFold(filepath.VolumeName(real), filepath.VolumeName(location)) {
    return filepath.Dir(location)
  }
  return real
}

func realpathIfPossible(location string) string {
  real, err := filepath.EvalSymlinks(location)
  if err != nil {
    return location
  }
  return real
}

// resolveDirLink chases a directory that is itself a symlink or NTFS junction
// to its target (bounded against link cycles). os.Readlink is the probe:
// it resolves junctions, which report neither ModeSymlink nor an
// EvalSymlinks-traversable path.
func resolveDirLink(dir string) string {
  for i := 0; i < 8; i++ {
    target, err := os.Readlink(dir)
    if err != nil {
      return dir
    }
    if !filepath.IsAbs(target) {
      target = filepath.Join(filepath.Dir(dir), target)
    }
    dir = target
  }
  return dir
}

// ttsxCommand returns a ttsx exec.Cmd bound to a background context. Use
// ttsxCommandContext when a deadline is needed (e.g. config file loading).
func ttsxCommand(args ...string) *exec.Cmd {
  return ttsxCommandContext(context.Background(), args...)
}

// ttsxCommandContext is the timeout-aware variant. Callers that
// evaluate user-supplied config should wrap their context with
// `context.WithTimeout(parent, configLoaderTimeout)` so a runaway
// `ttsx` subprocess can never hang the lint binary indefinitely.
func ttsxCommandContext(ctx context.Context, args ...string) *exec.Cmd {
  ttsx := os.Getenv("TTSC_TTSX_BINARY")
  if ttsx == "" {
    ttsx = "ttsx"
  }
  if shouldRunTtsxThroughNode(ttsx) {
    node := os.Getenv("TTSC_NODE_BINARY")
    if node == "" {
      node = "node"
    }
    return exec.CommandContext(ctx, node, append([]string{ttsx}, args...)...)
  }
  return exec.CommandContext(ctx, ttsx, args...)
}

// shouldRunTtsxThroughNode reports whether the resolved ttsx binary is a
// script (JS or TS extension) rather than a compiled native executable.
// Scripts must be executed via `node <binary> <args>` instead of directly.
func shouldRunTtsxThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

// nodeConfigLoaderEnv builds the environment for a Node.js config-loader
// subprocess. It prepends the nearest node_modules directory to NODE_PATH so
// that imports in .js/.cjs/.mjs config files resolve correctly even when the
// subprocess's cwd differs from the config file's location.
func nodeConfigLoaderEnv(location string) []string {
  env := os.Environ()
  parts := make([]string, 0, 2)
  if nodeModules := findNearestNodeModules(filepath.Dir(location)); nodeModules != "" {
    parts = append(parts, nodeModules)
  }
  if existing := os.Getenv("NODE_PATH"); existing != "" {
    parts = append(parts, existing)
  }
  if len(parts) == 0 {
    return env
  }
  return setEnv(env, "NODE_PATH", strings.Join(parts, string(os.PathListSeparator)))
}

// linkNearestNodeModules creates a node_modules symlink (or Windows junction)
// inside `tempDir` that points at the nearest node_modules directory found
// upward from `sourceDir`. This lets the TypeScript config loader resolve
// imports from the user's project without copying the entire module tree.
// If no node_modules directory exists, the function is a no-op.
func linkNearestNodeModules(tempDir, sourceDir string) error {
  nodeModules := findNearestNodeModules(sourceDir)
  if nodeModules == "" {
    return nil
  }
  link := filepath.Join(tempDir, "node_modules")
  err := os.Symlink(nodeModules, link)
  if err == nil {
    return nil
  }
  // Windows: a true symbolic link needs SeCreateSymbolicLinkPrivilege
  // (admin or Developer Mode). The JS side uses fs.symlink with the
  // `"junction"` type to dodge that restriction; here we shell out to
  // `mklink /J` to create an equivalent directory junction. Junctions
  // only work for absolute directory targets, which matches the input.
  if runtime.GOOS == "windows" {
    jerr := createWindowsJunction(link, nodeModules)
    if jerr == nil {
      return nil
    }
    err = fmt.Errorf("%w (junction fallback: %v)", err, jerr)
  }
  return fmt.Errorf("@ttsc/lint: link config node_modules %s: %w", nodeModules, err)
}

// createWindowsJunction creates a directory junction at `link` pointing at
// `target`. Junctions do not require elevated privileges (unlike symlinks on
// Windows), making them the right fallback when os.Symlink fails.
func createWindowsJunction(link, target string) error {
  return windowsjunction.Create(link, target)
}

// findNearestNodeModules walks upward from `start` and returns the first
// node_modules directory found, or the empty string if the filesystem root is
// reached without a match.
func findNearestNodeModules(start string) string {
  dir := filepath.Clean(start)
  for {
    candidate := filepath.Join(dir, "node_modules")
    if stat, err := os.Stat(candidate); err == nil && stat.IsDir() {
      return candidate
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

// setEnv updates an existing key=value entry in `env` (in-place) or appends
// a new one. It is intentionally a pure-slice helper — no os.Setenv side
// effects — so callers can pass it directly to exec.Cmd.Env.
func setEnv(env []string, key, value string) []string {
  prefix := key + "="
  for i, entry := range env {
    if strings.HasPrefix(entry, prefix) {
      env[i] = prefix + value
      return env
    }
  }
  return append(env, prefix+value)
}

// parseExternalRuleEntry delegates to parseRuleEntry. It is kept under this
// name because test files in the same package call it directly.
func parseExternalRuleEntry(v any) (Severity, json.RawMessage, error) {
  return parseRuleEntry(v)
}

// parseSeverity converts a raw config value to a Severity. Accepts the string
// literals "off", "warn"/"warning", "error" and the numeric equivalents 0, 1,
// 2 (the ESLint convention). Any other value is a hard error — there is no
// silent fallback so typos are surfaced immediately.
func parseSeverity(v any) (Severity, error) {
  switch x := v.(type) {
  case string:
    switch x {
    case "off":
      return SeverityOff, nil
    case "warning", "warn":
      return SeverityWarn, nil
    case "error":
      return SeverityError, nil
    }
    return SeverityOff, fmt.Errorf("unknown severity %q (want off | warn | warning | error)", x)
  case float64:
    switch x {
    case 0:
      return SeverityOff, nil
    case 1:
      return SeverityWarn, nil
    case 2:
      return SeverityError, nil
    }
    return SeverityOff, fmt.Errorf("unknown severity %v (want 0 | 1 | 2)", x)
  }
  return SeverityOff, fmt.Errorf("severity must be one of: off | warn | warning | error | 0 | 1 | 2, got %T", v)
}

// sortedRuleNames returns the sorted slice of rule names from `config` for
// which `include` returns true. Sorting ensures deterministic dispatch-table
// ordering so test output and diagnostic ordering are stable across runs.
func sortedRuleNames(config RuleConfig, include func(Severity) bool) []string {
  names := make([]string, 0, len(config))
  for name, sev := range config {
    if include(sev) {
      names = append(names, name)
    }
  }
  sort.Strings(names)
  return names
}

// matchAnyPattern reports whether `fileName` matches at least one of the
// provided glob patterns. If baseDir is non-empty, both paths are made
// absolute before computing a relative path so that glob patterns rooted at
// the config file's directory match correctly regardless of the process cwd.
// Files outside the base directory never match (the relative path would start
// with "..").
func matchAnyPattern(baseDir string, patterns []string, fileName string) bool {
  rel := filepath.ToSlash(fileName)
  if baseDir != "" {
    base := baseDir
    if abs, err := filepath.Abs(base); err == nil {
      base = abs
    }
    base = realProjectPath(base)
    file := fileName
    if abs, err := filepath.Abs(file); err == nil {
      file = abs
    }
    file = realProjectPath(file)
    if candidate, err := filepath.Rel(base, file); err == nil {
      if candidate == ".." || strings.HasPrefix(candidate, ".."+string(filepath.Separator)) {
        return false
      }
      rel = filepath.ToSlash(candidate)
    }
  }
  rel = strings.TrimPrefix(rel, "./")
  for _, pattern := range patterns {
    if matchGlob(normalizeGlobPattern(pattern), rel) {
      return true
    }
  }
  return false
}

// normalizeGlobPattern normalizes a user-supplied glob pattern to forward
// slashes and strips a leading "./". Patterns that contain no slash are treated
// as basename-only globs by prepending "**/" so that `*.ts` matches any
// TypeScript file regardless of directory depth, matching ESLint's behavior.
func normalizeGlobPattern(pattern string) string {
  pattern = filepath.ToSlash(pattern)
  pattern = strings.TrimPrefix(pattern, "./")
  if !strings.Contains(pattern, "/") {
    return "**/" + pattern
  }
  return pattern
}

// matchGlob tests whether `name` matches `pattern` using the ESLint-compatible
// glob semantics implemented by matchGlobParts. Both strings are trimmed of
// leading/trailing slashes before splitting on "/" so that empty segments do
// not appear in the part slices. Brace alternatives (`{a,b,c}`) are expanded
// before matching so patterns like `src/foo/{a.ts,b.ts}` reach every branch —
// Go's `filepath.Match` does not honor brace expansion natively.
func matchGlob(pattern, name string) bool {
  pattern = strings.Trim(pattern, "/")
  name = strings.Trim(name, "/")
  if pattern == "" {
    return name == ""
  }
  nameParts := []string{}
  if name != "" {
    nameParts = strings.Split(name, "/")
  }
  for _, expanded := range expandBraces(pattern) {
    if matchGlobParts(strings.Split(expanded, "/"), nameParts) {
      return true
    }
  }
  return false
}

// expandBraces expands shell-style brace alternatives (`{a,b,c}`) in `pattern`
// into the equivalent flat list of patterns. The expansion is recursive: a
// pattern with multiple brace groups produces the Cartesian product across all
// groups. Patterns with no braces, or with an unmatched opening `{`, are
// returned unchanged so that callers can treat the result as an authoritative
// list of every concrete alternative the user wrote.
//
// Only top-level braces are recognized; nested braces inside another brace
// group's alternative are honored by the recursion in alternative expansion,
// but escaped braces (`\{`, `\}`) are not currently supported because lint
// config patterns have no reason to embed literal braces. If a user ever needs
// one, the simplest workaround is to author the glob without the brace group.
func expandBraces(pattern string) []string {
  open := strings.IndexByte(pattern, '{')
  if open < 0 {
    return []string{pattern}
  }
  // Find the matching close brace, accounting for nested groups so the
  // outermost group is split first. A pattern with no matching close brace
  // is treated as a literal — return it unchanged. `closeIdx` shadows no
  // builtin (unlike the natural `close` name), which keeps `go vet` quiet.
  depth := 0
  closeIdx := -1
  for i := open; i < len(pattern); i++ {
    switch pattern[i] {
    case '{':
      depth++
    case '}':
      depth--
      if depth == 0 {
        closeIdx = i
      }
    }
    if closeIdx >= 0 {
      break
    }
  }
  if closeIdx < 0 {
    return []string{pattern}
  }
  prefix := pattern[:open]
  suffix := pattern[closeIdx+1:]
  // Split the brace body on top-level commas so nested groups remain
  // intact for the recursive expansion below.
  body := pattern[open+1 : closeIdx]
  alternatives := splitBraceAlternatives(body)
  // Expand each alternative against the suffix; the suffix may itself
  // contain further brace groups, which the recursive call handles.
  suffixExpansions := expandBraces(suffix)
  out := make([]string, 0, len(alternatives)*len(suffixExpansions))
  for _, alt := range alternatives {
    for _, altExpanded := range expandBraces(alt) {
      for _, suf := range suffixExpansions {
        out = append(out, prefix+altExpanded+suf)
      }
    }
  }
  return out
}

// splitBraceAlternatives splits the body of a brace group on top-level commas.
// Commas inside a nested `{...}` are not separators — the matching close brace
// is tracked so `a,{b,c},d` splits into three alternatives, not four.
func splitBraceAlternatives(body string) []string {
  out := []string{}
  depth := 0
  start := 0
  for i := 0; i < len(body); i++ {
    switch body[i] {
    case '{':
      depth++
    case '}':
      if depth > 0 {
        depth--
      }
    case ',':
      if depth == 0 {
        out = append(out, body[start:i])
        start = i + 1
      }
    }
  }
  out = append(out, body[start:])
  return out
}

// matchGlobParts recursively matches path segments against pattern segments.
// A "**" segment matches zero or more path segments (greedy: tries zero first,
// then each successive prefix) so that `**/*.ts` matches both `a.ts` and
// `dir/a.ts`.
func matchGlobParts(patternParts, nameParts []string) bool {
  if len(patternParts) == 0 {
    return len(nameParts) == 0
  }
  head := patternParts[0]
  if head == "**" {
    if matchGlobParts(patternParts[1:], nameParts) {
      return true
    }
    for i := range nameParts {
      if matchGlobParts(patternParts[1:], nameParts[i+1:]) {
        return true
      }
    }
    return false
  }
  if len(nameParts) == 0 {
    return false
  }
  ok, err := filepath.Match(head, nameParts[0])
  if err != nil || !ok {
    return false
  }
  return matchGlobParts(patternParts[1:], nameParts[1:])
}

// Severity returns the configured level for a rule, defaulting to
// `SeverityOff`. Rules opt in explicitly — silent on missing entries.
func (c RuleConfig) Severity(name string) Severity {
  if c == nil {
    return SeverityOff
  }
  if sev, ok := c[name]; ok {
    return sev
  }
  canonical := normalizeBuiltinRuleName(name)
  if sev, ok := c[canonical]; ok {
    return sev
  }
  return SeverityOff
}
