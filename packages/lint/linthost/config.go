package linthost

import (
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "sync"
  "time"
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

// RuleOptionsMap captures the rule-specific options blob, keyed by rule
// name. Severity-only rules never appear here. The values are the raw
// JSON the user wrote in the second tuple slot of a `["error", { ... }]`
// rule setting; each rule decodes the blob into its own option struct on
// demand.
type RuleOptionsMap map[string]json.RawMessage

// ResolvedRuleConfig is the rule map that applies to one source file.
// `Ignored` means an `ignores`-only config entry matched the file and the
// engine should skip linting it entirely.
type ResolvedRuleConfig struct {
  Rules   RuleConfig
  Ignored bool
}

// RuleResolver is the engine-facing view of a resolved lint configuration.
// Implementations include RuleConfig (severity-only, no options),
// InlineRuleResolver (a severity map plus per-rule options), and *ConfigStore
// (a parsed lint config file, with per-file glob resolution and a unified
// options map).
type RuleResolver interface {
  // ResolveRules returns the effective severity map for the given source file.
  // Implementations that support `files`/`ignores` patterns apply them here;
  // flat RuleConfig always returns all rules unchanged.
  ResolveRules(fileName string) ResolvedRuleConfig
  // ActiveRuleNames returns the sorted names of every rule that is not SeverityOff
  // in at least one config entry. Used to build the engine's dispatch table.
  ActiveRuleNames() []string
  // EnabledRuleConfig returns the project-wide severity map for rules that are
  // not SeverityOff. Where multiple entries disagree, SeverityError wins.
  EnabledRuleConfig() RuleConfig
  // RuleOptions returns the raw JSON options for `name`, or nil when the
  // rule was configured with a severity alone. Returns nil for unknown
  // rule names too — rules treat that as "use defaults".
  RuleOptions(name string) json.RawMessage
}

// ResolveRules implements RuleResolver. A flat RuleConfig has no glob scoping,
// so every file receives the full map unchanged.
func (c RuleConfig) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{Rules: c}
}

// ActiveRuleNames implements RuleResolver. Returns rule names whose severity
// is not SeverityOff, sorted for deterministic engine dispatch-table construction.
func (c RuleConfig) ActiveRuleNames() []string {
  return sortedRuleNames(c, func(sev Severity) bool { return sev != SeverityOff })
}

// EnabledRuleConfig implements RuleResolver. Returns a copy containing only the
// non-off entries; used to populate engine state and diagnostic reporting.
func (c RuleConfig) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  for name, sev := range c {
    if sev != SeverityOff {
      out[name] = sev
    }
  }
  return out
}

// RuleOptions on a bare RuleConfig is always nil — this form is the
// severity-only path used by Go unit tests and rule constructors that
// predate option support.
func (RuleConfig) RuleOptions(string) json.RawMessage { return nil }

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
  return ResolvedRuleConfig{Rules: r.Rules}
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
  return r.Options[name]
}

// ConfigStore holds the parsed representation of a lint config file. It
// implements RuleResolver with per-file glob scoping: ResolveRules walks the
// entries in declaration order and the last matching entry wins. Options are
// intentionally NOT per-file — one project-wide options map is kept so rule
// behavior is uniform across the codebase even when severity varies by glob.
//
// A config file is a single `ITtscLintConfig` object. Its `extends` field
// names another config file to fold in first; the extends chain produces one
// ConfigEntry per file, the extends-target entries declared before the
// extending file's own entry so local rules win on collision.
type ConfigStore struct {
  entries []ConfigEntry
  // options is a flat rule-name → JSON map. Options are not scoped by
  // `files` / `ignores`: a rule's behavior is a single project-wide
  // configuration even when its severity is per-file. The simplification
  // matches prettier-style options (one setting per project) while
  // keeping severity layering intact.
  options RuleOptionsMap
}

// RuleOptions implements RuleResolver.RuleOptions on ConfigStore.
func (s *ConfigStore) RuleOptions(name string) json.RawMessage {
  if s == nil {
    return nil
  }
  return s.options[name]
}

// ConfigEntry is the parsed form of one config file in the extends chain.
// BaseDir anchors glob resolution; Files and Ignores are the pattern lists.
// IgnoreOnly marks entries that carry only `ignores` (no `files`, no `rules`)
// — these are evaluated first in ResolveRules and short-circuit the walk when
// matched.
type ConfigEntry struct {
  BaseDir    string
  Files      []string
  Ignores    []string
  Rules      RuleConfig
  IgnoreOnly bool
}

// ResolveRules implements RuleResolver. Ignore-only entries are checked first;
// if one matches, the file is marked Ignored and linting is skipped entirely.
// Otherwise the entries are walked in declaration order and the last matching
// entry wins (later entries shadow earlier ones for the same rule name).
func (s *ConfigStore) ResolveRules(fileName string) ResolvedRuleConfig {
  if s == nil {
    return ResolvedRuleConfig{Rules: RuleConfig{}}
  }
  for _, entry := range s.entries {
    if entry.IgnoreOnly && entry.matchesIgnores(fileName) {
      return ResolvedRuleConfig{Rules: RuleConfig{}, Ignored: true}
    }
  }
  out := RuleConfig{}
  for _, entry := range s.entries {
    if entry.IgnoreOnly || !entry.matchesFile(fileName) {
      continue
    }
    for name, sev := range entry.Rules {
      out[name] = sev
    }
  }
  return ResolvedRuleConfig{Rules: out}
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
        active[name] = sev
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
      if out[name] != SeverityError {
        out[name] = sev
      }
    }
  }
  return out
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
      out[name] = sev
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
// `[severity, options]` tuple per rule and returns the severity map
// alongside an options map keyed by rule name. The options map only
// contains entries for rules whose configuration was the tuple form.
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

// parseRuleEntry splits a rule entry into its severity and (optional) options
// payload. Bare severity literals produce a nil options blob; `[severity]`
// (no options) does the same; `[severity, options]` re-serializes the options
// to JSON so each rule can decode it into its own struct later.
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
    if len(tuple) > 2 {
      return SeverityOff, nil, fmt.Errorf("severity tuple must be [severity] or [severity, options], got %d elements", len(tuple))
    }
    if tuple[1] == nil {
      return sev, nil, nil
    }
    if _, ok := tuple[1].(map[string]any); !ok {
      // A positional string option (e.g. `["error", "single"]`) is
      // rejected: every option struct in TtscLintRuleOptions is an
      // object, and silently encoding a non-object slot would land in
      // DecodeOptions as a decode error that every rule discards. Fail
      // loudly so users discover the proper `["error", { … }]` form.
      return SeverityOff, nil, fmt.Errorf("severity tuple's options slot must be an object, got %T", tuple[1])
    }
    encoded, err := json.Marshal(tuple[1])
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
  store := &ConfigStore{}
  var chain []string
  if rootPath != "" {
    chain = []string{filepath.Clean(rootPath)}
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
    extendedRaw, err := loadConfigFile(location)
    if err != nil {
      return err
    }
    if err := collectConfigObject(store, extendedRaw, filepath.Dir(location), path+".extends", extendedChain); err != nil {
      return err
    }
  }

  files, err := parsePatternList(obj["files"], path+".files")
  if err != nil {
    return err
  }
  ignores, err := parsePatternList(obj["ignores"], path+".ignores")
  if err != nil {
    return err
  }

  rulesValue, hasRules := obj["rules"]
  formatValue, hasFormat := obj["format"]
  if hasRules || hasFormat {
    // Expand the format block (if any) into a rules-shaped map, then
    // overlay any explicit `rules` entries. `rules`-wins semantics: a
    // `rules` entry that names a `format/*` rule fully replaces the
    // entry expanded from the `format` block.
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
      rulesMap = typedMap
    }
    merged := mergeRuleMaps(formatRulesRaw, rulesMap)
    if len(merged) > 0 {
      parsed, err := parseExternalRuleMapInto(merged, path+".rules", store)
      if err != nil {
        return err
      }
      store.entries = append(store.entries, ConfigEntry{
        BaseDir: baseDir,
        Files:   files,
        Ignores: ignores,
        Rules:   parsed,
      })
    }
    return nil
  }

  if len(files) == 0 && len(ignores) > 0 {
    store.entries = append(store.entries, ConfigEntry{
      BaseDir:    baseDir,
      Ignores:    ignores,
      IgnoreOnly: true,
    })
  }
  return nil
}

// parseExternalRuleMapInto parses the rules map and folds any
// option blobs into `store.options`. Used by entry-creation paths so
// the store ends with a unified options map for RuleResolver consumers.
func parseExternalRuleMapInto(raw any, path string, store *ConfigStore) (RuleConfig, error) {
  out := RuleConfig{}
  if store.options == nil {
    store.options = RuleOptionsMap{}
  }
  if err := collectExternalRuleMapWithOptions(out, store.options, raw, path); err != nil {
    return nil, err
  }
  return out, nil
}

// collectExternalRuleMapWithOptions also records the rule's options blob
// when the entry is a `[severity, options]` tuple. `opts` may be nil
// when the caller does not need option capture.
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
    canonical := normalizeExternalRuleName(name)
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

// normalizeExternalRuleName strips the standard typescript-eslint namespace
// prefixes so that rules like "@typescript-eslint/no-explicit-any" and the
// bare "no-explicit-any" key both resolve to the same engine-internal name.
func normalizeExternalRuleName(name string) string {
  name = strings.TrimPrefix(name, "@typescript-eslint/")
  return strings.TrimPrefix(name, "typescript-eslint/")
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

  if configFileValue, ok := inline["configFile"]; ok {
    configFile, ok := configFileValue.(string)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must be a string path, got %T", configFileValue)
    }
    if strings.TrimSpace(configFile) == "" {
      return nil, fmt.Errorf("@ttsc/lint: \"configFile\" must not be empty")
    }
    location := resolveConfigFilePath(configFile, cwd, tsconfigPath)
    return loadConfigResolver(location)
  }

  discovered, err := findLintConfigFile(cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  if discovered == "" {
    return nil, fmt.Errorf("@ttsc/lint: no lint.config.* or ttsc-lint.config.* file found (searched upward from %s); create one or set \"configFile\" on the tsconfig plugin entry", cwd)
  }
  return loadConfigResolver(discovered)
}

// loadConfigResolver loads and parses the lint config file at `location` into
// a *ConfigStore and returns it as a RuleResolver.
func loadConfigResolver(location string) (RuleResolver, error) {
  raw, err := loadConfigFile(location)
  if err != nil {
    return nil, err
  }
  store, err := collectConfigStore(raw, filepath.Dir(location), location)
  if err != nil {
    return nil, err
  }
  return store, nil
}

func findLintConfigFile(cwd, tsconfigPath string) (string, error) {
  dir := discoveryConfigBaseDir(cwd, tsconfigPath)
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

// resolveConfigFilePath resolves a user-supplied config path to an absolute
// path. Absolute paths are returned unchanged; relative paths are joined to the
// tsconfig directory (or cwd when no tsconfig is set).
func resolveConfigFilePath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

// discoveryConfigBaseDir returns the directory from which auto-discovery walks
// upward when no explicit config path is provided. Prefer the tsconfig
// directory over cwd so that nested package configs are found relative to the
// tsconfig that triggered the lint run.
func discoveryConfigBaseDir(cwd, tsconfigPath string) string {
  if tsconfigPath != "" {
    resolvedTsconfig := tsconfigPath
    if !filepath.IsAbs(resolvedTsconfig) {
      resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
    }
    return filepath.Dir(resolvedTsconfig)
  }
  return cwd
}

// tsconfigBaseDir returns the directory that contains the tsconfig file, or
// cwd when tsconfigPath is empty. Used as the base for relative config paths
// supplied in the tsconfig plugin entry.
func tsconfigBaseDir(cwd, tsconfigPath string) string {
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
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadJSONConfigFile(location)
  case ".js", ".cjs", ".mjs":
    return loadCachedConfigFile(location, loadScriptConfigFile)
  case ".ts", ".cts", ".mts":
    return loadCachedConfigFile(location, loadTypeScriptConfigFile)
  default:
    return nil, fmt.Errorf("@ttsc/lint: unsupported config file extension %q for %s", ext, location)
  }
}

// configCacheVersion namespaces the on-disk config cache. Bump it whenever
// the shape of a cached config object changes so that entries written by an
// older @ttsc/lint binary are treated as a miss rather than silently reused.
const configCacheVersion = "v1"

// configEvalCache memoizes evaluated .ts/.js lint config objects for the
// lifetime of one process; the on-disk cache (configCacheDir) extends the
// same memoization across the separate `ttsc` processes a monorepo build
// spawns. Guarded by configEvalCacheMu.
var (
  configEvalCacheMu sync.Mutex
  configEvalCache   = map[string]any{}
)

// configCacheDir is the directory shared by this Go sidecar and the JS
// plugin factory (packages/lint/src/index.ts) for cached lint configs.
// Evaluating a .ts/.js config means spawning a ttsx/node subprocess; the
// cache keeps every `ttsc` invocation after the first from re-paying it.
func configCacheDir() string {
  return filepath.Join(os.TempDir(), "ttsc-lint-config-cache")
}

// configCacheDisabled reports whether the env opt-out is set — an escape
// hatch for callers that must force a fresh evaluation (e.g. a config whose
// behavior depends on imported non-config files that the key cannot see).
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

// loadCachedConfigFile wraps a subprocess-backed config loader (`eval`)
// with the two-tier (in-process + on-disk) config cache. The cache key
// covers the config file's path and bytes only — a config's own `import`s
// of non-config files are NOT tracked, since a lint config is expected to
// be self-contained; set TTSC_LINT_DISABLE_CONFIG_CACHE when it is not.
// Errors are never cached: a failed evaluation re-runs next time.
func loadCachedConfigFile(location string, eval func(string) (any, error)) (any, error) {
  if configCacheDisabled() {
    return eval(location)
  }
  content, err := os.ReadFile(location)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
  }
  abs := location
  if resolved, absErr := filepath.Abs(location); absErr == nil {
    abs = resolved
  }
  key := configCacheKey("config", abs, content)

  configEvalCacheMu.Lock()
  cached, ok := configEvalCache[key]
  configEvalCacheMu.Unlock()
  if ok {
    return cached, nil
  }
  if value, hit := readConfigDiskCache(key); hit {
    configEvalCacheMu.Lock()
    configEvalCache[key] = value
    configEvalCacheMu.Unlock()
    return value, nil
  }

  value, err := eval(location)
  if err != nil {
    return nil, err
  }
  configEvalCacheMu.Lock()
  configEvalCache[key] = value
  configEvalCacheMu.Unlock()
  writeConfigDiskCache(key, value)
  return value, nil
}

// readConfigDiskCache returns the cached config object for `key`, or
// (nil, false) on any miss — a missing file, an unreadable file, or
// content that no longer parses as a config object. Every failure is a
// soft miss: the caller re-evaluates rather than surfacing a cache fault.
func readConfigDiskCache(key string) (any, bool) {
  body, err := os.ReadFile(filepath.Join(configCacheDir(), key+".json"))
  if err != nil {
    return nil, false
  }
  var value any
  if err := json.Unmarshal(body, &value); err != nil {
    return nil, false
  }
  if !isConfigObject(value) {
    return nil, false
  }
  return value, true
}

// writeConfigDiskCache stores `value` under `key`. It is best-effort: a
// failure to create the directory or write the file leaves the cache cold
// (the next run re-evaluates) rather than failing the lint run. The write
// goes through a temp file + rename so a concurrent reader in a sibling
// `ttsc` process never observes a half-written entry.
func writeConfigDiskCache(key string, value any) {
  body, err := json.Marshal(value)
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

// loadScriptConfigFile evaluates a .js/.cjs/.mjs config file by running a
// Node subprocess that dynamic-imports the file, resolves the exported config
// through the same 8-hop default/config unwrap used by the TS loader, and
// serializes the result as JSON to stdout. The subprocess has a
// configLoaderTimeout deadline to prevent user code from hanging indefinitely.
func loadScriptConfigFile(location string) (any, error) {
  const script = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  let current = mod;
  let allowNamedConfig = true;
  // Match the 8-hop walk used by the TypeScript loader at
  // ` + "`" + `typeScriptConfigLoaderSource` + "`" + ` so doubly-wrapped CJS/ESM
  // interop (e.g. ` + "`" + `{default:{default:config}}` + "`" + `) is resolved
  // consistently across .js/.cjs/.mjs and .ts/.cts/.mts loaders.
  for (let i = 0; i < 8; i++) {
    if (current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, "default")) {
      current = current.default;
      allowNamedConfig = false;
      continue;
    }
    if (allowNamedConfig && current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, "config")) {
      current = current.config;
      allowNamedConfig = false;
      continue;
    }
    break;
  }
  const value = typeof current === "function" ? await current() : current;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("config file must export an ITtscLintConfig object");
  }
  process.stdout.write(JSON.stringify(toSerializableConfig(value)));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is ` + "`" + `format` + "`" + ` is not silently dropped.
function toSerializableConfig(value) {
  const out = {};
  for (const key of ["files", "ignores", "extends", "plugins", "rules", "format"]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  ctx, cancel := context.WithTimeout(context.Background(), configLoaderTimeout)
  defer cancel()
  cmd := exec.CommandContext(ctx, node, "-e", script, location)
  output, err := cmd.Output()
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf("@ttsc/lint: load config file %s: timed out after %s", location, configLoaderTimeout)
    }
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/lint: load config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/lint: load config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: parse config file %s output: %w", location, err)
  }
  if !isConfigObject(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  return out, nil
}

// loadTypeScriptConfigFile evaluates a .ts/.cts/.mts config file by writing
// an ephemeral loader script and tsconfig into a temp directory, symlinking the
// nearest node_modules, then running `ttsx` with a configLoaderTimeout deadline.
// The loader script imports the config file, resolves it through the same
// unwrap chain used by loadScriptConfigFile, and writes JSON to stdout.
func loadTypeScriptConfigFile(location string) (any, error) {
  tempDir, err := os.MkdirTemp("", "ttsc-lint-config-")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/lint: create config loader tempdir: %w", err)
  }
  defer os.RemoveAll(tempDir)

  if err := linkNearestNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return nil, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importSpecifier, err := relativeImportSpecifier(tempDir, location)
  if err != nil {
    return nil, err
  }
  importLiteral, err := json.Marshal(importSpecifier)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/lint: encode config import %s: %w", location, err)
  }
  if err := os.WriteFile(loader, []byte(typeScriptConfigLoaderSource(string(importLiteral))), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: write config loader: %w", err)
  }
  if err := os.WriteFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: write config loader tsconfig: %w", err)
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
  output, err := cmd.Output()
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf("@ttsc/lint: load TypeScript config file %s: timed out after %s", location, configLoaderTimeout)
    }
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/lint: load TypeScript config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/lint: load TypeScript config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: parse TypeScript config file %s output: %w", location, err)
  }
  if !isConfigObject(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an ITtscLintConfig object", location)
  }
  return out, nil
}

// isConfigObject reports whether `value` is a top-level config object. A lint
// config file always exports a single `ITtscLintConfig` object; arrays and
// scalars are rejected so users get a clear error instead of an opaque parse
// failure downstream.
func isConfigObject(value any) bool {
  _, ok := value.(map[string]any)
  return ok
}

// relativeImportSpecifier computes the ESM import specifier for `location`
// relative to `fromDir`. The result always starts with "./" or "../" so it is
// treated as a relative path by the ESM loader rather than as a bare package
// name.
func relativeImportSpecifier(fromDir, location string) (string, error) {
  relative, err := filepath.Rel(fromDir, location)
  if err != nil {
    return "", fmt.Errorf("@ttsc/lint: resolve relative config import %s: %w", location, err)
  }
  relative = filepath.ToSlash(relative)
  if strings.HasPrefix(relative, "../") || strings.HasPrefix(relative, "./") {
    return relative, nil
  }
  return "./" + relative, nil
}

// typeScriptConfigLoaderSource returns the TypeScript source of the ephemeral
// loader script that ttsx executes to evaluate a TypeScript lint config file.
// `importLiteral` is a JSON-encoded relative import path (e.g. `"./lint.config.ts"`)
// that is spliced directly into the `import * as` statement, so it must
// already be a valid JSON string (produced by json.Marshal).
func typeScriptConfigLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`import * as importedConfig from %s;

declare const process: {
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  const value = await resolveConfig(importedConfig, true);
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("config file must export an ITtscLintConfig object");
  }
  process.stdout.write(JSON.stringify(toSerializableConfig(value)));
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}

async function resolveConfig(value: unknown, allowNamedConfig: boolean): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (isObject(current) && hasOwn(current, "default")) {
      current = current.default;
      allowNamedConfig = false;
      continue;
    }
    if (allowNamedConfig && isObject(current) && hasOwn(current, "config")) {
      current = current.config;
      allowNamedConfig = false;
      continue;
    }
    break;
  }
  if (typeof current === "function") {
    return await (current as () => unknown | Promise<unknown>)();
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

// toSerializableConfig copies every ITtscLintConfig key onto a plain object so
// it survives the JSON round trip to the Go sidecar. Every key is copied
// verbatim — files, ignores, extends, plugins, rules, AND format — so a config
// whose only key is "format" is not silently dropped.
function toSerializableConfig(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["files", "ignores", "extends", "plugins", "rules", "format"]) {
    if (hasOwn(value, key)) {
      out[key] = value[key];
    }
  }
  return out;
}
`, importLiteral)
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
      "rootDir":                         "/",
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
// `target` using `cmd /c mklink /J`. Junctions do not require elevated
// privileges (unlike symlinks on Windows), making them the right fallback when
// os.Symlink fails.
func createWindowsJunction(link, target string) error {
  // `cmd /c mklink /J link target` is the standard recipe and works
  // without elevated privileges. Both arguments must be absolute paths
  // with native separators, which they already are here.
  cmd := exec.Command("cmd", "/c", "mklink", "/J", link, target)
  if out, err := cmd.CombinedOutput(); err != nil {
    return fmt.Errorf("mklink /J failed: %v: %s", err, strings.TrimSpace(string(out)))
  }
  return nil
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
    file := fileName
    if abs, err := filepath.Abs(file); err == nil {
      file = abs
    }
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
// not appear in the part slices.
func matchGlob(pattern, name string) bool {
  pattern = strings.Trim(pattern, "/")
  name = strings.Trim(name, "/")
  if pattern == "" {
    return name == ""
  }
  patternParts := strings.Split(pattern, "/")
  nameParts := []string{}
  if name != "" {
    nameParts = strings.Split(name, "/")
  }
  return matchGlobParts(patternParts, nameParts)
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
  return c[name]
}
