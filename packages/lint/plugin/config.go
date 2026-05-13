package main

import (
  "bytes"
  "context"
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

// ResolvedRuleConfig is the rule map that applies to one source file.
// `Ignored` means an external ESLint-style ignore-only config matched the
// file and the engine should skip linting it entirely.
type ResolvedRuleConfig struct {
  Rules   RuleConfig
  Ignored bool
}

type RuleResolver interface {
  ResolveRules(fileName string) ResolvedRuleConfig
  ActiveRuleNames() []string
  EnabledRuleConfig() RuleConfig
}

func (c RuleConfig) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{Rules: c}
}

func (c RuleConfig) ActiveRuleNames() []string {
  return sortedRuleNames(c, func(sev Severity) bool { return sev != SeverityOff })
}

func (c RuleConfig) EnabledRuleConfig() RuleConfig {
  out := RuleConfig{}
  for name, sev := range c {
    if sev != SeverityOff {
      out[name] = sev
    }
  }
  return out
}

type ConfigStore struct {
  entries               []ConfigEntry
  externalConfigPath    string
  eslintRuntime         bool
  eslintRuntimeRequired bool
}

type ConfigEntry struct {
  BaseDir    string
  Files      []string
  Ignores    []string
  Rules      RuleConfig
  IgnoreOnly bool
}

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

func (s *ConfigStore) ExternalConfigPath() string {
  if s == nil {
    return ""
  }
  return s.externalConfigPath
}

func (s *ConfigStore) WantsESLintRuntime() bool {
  if s == nil {
    return false
  }
  if s.eslintRuntime {
    return true
  }
  base := filepath.Base(s.externalConfigPath)
  return strings.HasPrefix(base, "eslint.config.")
}

func (s *ConfigStore) RequiresESLintRuntime() bool {
  if s == nil {
    return false
  }
  return s.eslintRuntimeRequired
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

// ParseRules normalizes the standard native rules map from a tsconfig plugin
// entry.
//
// Severity values:
//   - `"off"` → SeverityOff
//   - `"warning"` → SeverityWarn
//   - `"error"` → SeverityError
//
// Anything else returns an error (no silent fallback — typos in a rule
// severity should be loud).
func ParseRules(raw any) (RuleConfig, error) {
  if raw == nil {
    return RuleConfig{}, nil
  }
  dict, ok := raw.(map[string]any)
  if !ok {
    return nil, fmt.Errorf("@ttsc/lint: \"config\" must be an object, got %T", raw)
  }
  out := make(RuleConfig, len(dict))
  for name, value := range dict {
    sev, err := parseSeverity(value)
    if err != nil {
      return nil, fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    out[name] = sev
  }
  return out, nil
}

func parseExternalConfigRules(raw any) (RuleConfig, error) {
  store, err := parseExternalConfigStore(raw, "")
  if err != nil {
    return nil, err
  }
  return store.Flatten(), nil
}

func parseExternalConfigStore(raw any, configDir string) (*ConfigStore, error) {
  return parseExternalConfigStoreWithRuntimeMode(raw, configDir, false)
}

func parseExternalConfigStoreForFile(raw any, configDir string) (*ConfigStore, error) {
  return parseExternalConfigStoreWithRuntimeMode(raw, configDir, true)
}

func parseExternalConfigStoreWithRuntimeMode(raw any, configDir string, allowRuntimeOnly bool) (*ConfigStore, error) {
  store := &ConfigStore{}
  if err := collectExternalConfigEntries(store, raw, configDir, "config", allowRuntimeOnly); err != nil {
    return nil, err
  }
  return store, nil
}

func collectExternalConfigEntries(store *ConfigStore, raw any, baseDir, path string, allowRuntimeOnly bool) error {
  if raw == nil {
    return nil
  }
  switch typed := raw.(type) {
  case []any:
    for i, item := range typed {
      if err := collectExternalConfigEntries(store, item, baseDir, fmt.Sprintf("%s[%d]", path, i), allowRuntimeOnly); err != nil {
        return err
      }
    }
    return nil
  case map[string]any:
    if isESLintConfigObject(typed) {
      if marker, ok := typed["__ttscLintEslintRuntime"].(bool); ok && marker {
        store.eslintRuntime = true
        store.eslintRuntimeRequired = true
      }
      localBaseDir := baseDir
      if rawBasePath, ok := typed["basePath"]; ok {
        basePath, ok := rawBasePath.(string)
        if !ok {
          return fmt.Errorf("@ttsc/lint: %s.basePath must be a string, got %T", path, rawBasePath)
        }
        if filepath.IsAbs(basePath) {
          localBaseDir = basePath
        } else {
          localBaseDir = filepath.Join(baseDir, basePath)
        }
      }
      if hasESLintRuntimeFields(typed) {
        store.eslintRuntime = true
        store.eslintRuntimeRequired = true
      }
      if extended, ok := typed["extends"]; ok {
        if err := collectExternalExtends(store, extended, localBaseDir, path+".extends", allowRuntimeOnly); err != nil {
          return err
        }
      }
      files, err := parsePatternList(typed["files"], path+".files")
      if err != nil {
        return err
      }
      ignores, err := parsePatternList(typed["ignores"], path+".ignores")
      if err != nil {
        return err
      }
      if rules, ok := typed["rules"]; ok {
        parsed, err := parseExternalRuleMap(rules, path+".rules")
        if err != nil {
          return err
        }
        store.entries = append(store.entries, ConfigEntry{
          BaseDir: localBaseDir,
          Files:   files,
          Ignores: ignores,
          Rules:   parsed,
        })
        return nil
      }
      if len(files) == 0 && len(ignores) > 0 {
        store.entries = append(store.entries, ConfigEntry{
          BaseDir:    localBaseDir,
          Ignores:    ignores,
          IgnoreOnly: true,
        })
      }
      return nil
    }
    parsed, err := parseExternalRuleMap(typed, path)
    if err != nil {
      return err
    }
    store.entries = append(store.entries, ConfigEntry{
      BaseDir: baseDir,
      Rules:   parsed,
    })
    return nil
  default:
    return fmt.Errorf("@ttsc/lint: %s must be an object or flat config array, got %T", path, raw)
  }
}

func collectExternalExtends(store *ConfigStore, raw any, baseDir, path string, allowRuntimeOnly bool) error {
  switch typed := raw.(type) {
  case string:
    if allowRuntimeOnly {
      store.eslintRuntime = true
      store.eslintRuntimeRequired = true
      return nil
    }
    return fmt.Errorf("@ttsc/lint: %s must be an object or flat config array, got %T", path, raw)
  case []any:
    for i, item := range typed {
      itemPath := fmt.Sprintf("%s[%d]", path, i)
      if _, ok := item.(string); ok && allowRuntimeOnly {
        store.eslintRuntime = true
        store.eslintRuntimeRequired = true
        continue
      }
      if err := collectExternalConfigEntries(store, item, baseDir, itemPath, allowRuntimeOnly); err != nil {
        return err
      }
    }
    return nil
  default:
    return collectExternalConfigEntries(store, raw, baseDir, path, allowRuntimeOnly)
  }
}

func parseExternalRuleMap(raw any, path string) (RuleConfig, error) {
  out := RuleConfig{}
  if err := collectExternalRuleMap(out, raw, path); err != nil {
    return nil, err
  }
  return out, nil
}

func collectExternalRuleMap(out RuleConfig, raw any, path string) error {
  dict, ok := raw.(map[string]any)
  if !ok {
    return fmt.Errorf("@ttsc/lint: %s must be a rules object, got %T", path, raw)
  }
  for name, value := range dict {
    sev, err := parseExternalSeverity(value)
    if err != nil {
      return fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
    }
    out[normalizeExternalRuleName(name)] = sev
  }
  return nil
}

func isESLintConfigObject(value map[string]any) bool {
  for _, key := range []string{
    "basePath",
    "extends",
    "files",
    "ignores",
    "languageOptions",
    "linterOptions",
    "name",
    "plugins",
    "processor",
    "rules",
    "settings",
    "__ttscLintEslintRuntime",
  } {
    if _, ok := value[key]; ok {
      return true
    }
  }
  return false
}

func hasESLintRuntimeFields(value map[string]any) bool {
  for _, key := range []string{
    "languageOptions",
    "linterOptions",
    "processor",
    "settings",
  } {
    if _, ok := value[key]; ok {
      return true
    }
  }
  if plugins, ok := value["plugins"]; ok {
    if !isNativePluginMap(plugins) {
      return true
    }
  }
  return false
}

// isNativePluginMap reports whether every entry in a flat-config
// `plugins` map points at a ttsc-lint native contributor object
// (carrying a non-empty string `source` field). Native contributors are
// compiled into the lint binary at build time and require no JS ESLint
// runtime; only mixed or pure-ESLint plugin maps require the runtime
// fallback.
func isNativePluginMap(value any) bool {
  dict, ok := value.(map[string]any)
  if !ok {
    return false
  }
  if len(dict) == 0 {
    return true
  }
  for _, entry := range dict {
    if !isNativePluginValue(entry) {
      return false
    }
  }
  return true
}

func isNativePluginValue(entry any) bool {
  if entry == nil {
    return false
  }
  switch typed := entry.(type) {
  case string:
    // A non-empty string is a native npm specifier (matching the JS
    // factory's `normalizePluginValue` contract for `.js`/`.cjs`/`.ts`
    // configs and the JSON-only `readJsonConfigPlugins` path). The JS
    // factory resolves the specifier at load time and bakes the
    // contributor into the binary, so the Go sidecar should not flip
    // `eslintRuntimeRequired` for a file that already declared a
    // native specifier.
    return typed != ""
  case map[string]any:
    // Walk ESM-from-CJS `.default` indirection so a contributor authored
    // as `export default plugin` registers as native here, matching the
    // JS factory's `extractPluginSource` behavior.
    current := typed
    for i := 0; i < 4; i++ {
      if source, ok := current["source"].(string); ok && source != "" {
        return true
      }
      next, ok := current["default"].(map[string]any)
      if !ok {
        return false
      }
      current = next
    }
    return false
  default:
    return false
  }
}

func normalizeExternalRuleName(name string) string {
  name = strings.TrimPrefix(name, "@typescript-eslint/")
  return strings.TrimPrefix(name, "typescript-eslint/")
}

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

// LoadRuleConfig resolves the lint config for one plugin entry. The only
// accepted lint-specific tsconfig key is `config`; it may be either an inline
// rules object or a string path to a standalone config file. Relative config
// paths are resolved from the tsconfig directory.
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

// LoadConfigResolver resolves one plugin entry into the engine-facing
// config model.
//
// Two equivalent input shapes are accepted:
//
//   - `rules` (inline severity map) + `extends` (config file path) —
//     the canonical fields mirroring ESLint flat-config vocabulary.
//   - `config` (legacy) — accepts the same string-or-map values but
//     emits a one-time stderr deprecation notice. Removed in a future
//     minor.
//
// `rules` and `extends` are mutually exclusive on a single plugin
// entry; mixing legacy `config` with either new field is rejected.
// `configFile` and `configPath` remain reserved keywords surfaced with
// a hint pointing at `extends`, in case a user mistakenly reaches for
// either spelling.
func LoadConfigResolver(entry *PluginEntry, cwd, tsconfigPath string) (RuleResolver, error) {
  if entry == nil {
    return RuleConfig{}, nil
  }
  inline := entry.Config
  if inline == nil {
    inline = map[string]any{}
  }
  for _, key := range []string{"configFile", "configPath"} {
    if _, ok := inline[key]; ok {
      return nil, fmt.Errorf("@ttsc/lint: %q is not supported; use \"extends\"", key)
    }
  }

  rulesValue, hasRules := inline["rules"]
  extendsValue, hasExtends := inline["extends"]
  legacyValue, hasLegacy := inline["config"]

  if hasLegacy && (hasRules || hasExtends) {
    return nil, fmt.Errorf("@ttsc/lint: tsconfig plugin entry mixes legacy \"config\" with the new \"rules\"/\"extends\" fields; remove \"config\" (deprecated)")
  }
  if hasRules && hasExtends {
    return nil, fmt.Errorf("@ttsc/lint: \"rules\" and \"extends\" cannot be combined on a single plugin entry; put base rules in the \"extends\" file and inline overrides in lint.config.ts itself")
  }

  if hasRules {
    rulesMap, ok := rulesValue.(map[string]any)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: \"rules\" must be a rule severity map, got %T", rulesValue)
    }
    return ParseRules(rulesMap)
  }
  if hasExtends {
    extendsStr, ok := extendsValue.(string)
    if !ok {
      return nil, fmt.Errorf("@ttsc/lint: \"extends\" must be a string path, got %T", extendsValue)
    }
    if strings.TrimSpace(extendsStr) == "" {
      return nil, fmt.Errorf("@ttsc/lint: \"extends\" must not be empty")
    }
    location := resolveConfigFilePath(extendsStr, cwd, tsconfigPath)
    return loadExternalConfigResolver(location)
  }
  if hasLegacy {
    emitLegacyConfigDeprecation()
    switch typed := legacyValue.(type) {
    case string:
      if strings.TrimSpace(typed) == "" {
        return nil, fmt.Errorf("@ttsc/lint: legacy \"config\" must not be empty")
      }
      location := resolveConfigFilePath(typed, cwd, tsconfigPath)
      return loadExternalConfigResolver(location)
    case map[string]any:
      return ParseRules(typed)
    default:
      return nil, fmt.Errorf("@ttsc/lint: legacy \"config\" must be a string path or object, got %T", legacyValue)
    }
  }

  discovered, err := findLintConfigFile(cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  if discovered == "" {
    return nil, fmt.Errorf("@ttsc/lint: \"rules\" or \"extends\" is required when no lint.config.*, ttsc-lint.config.*, or supported eslint.config.* file can be discovered (searched upward from %s)", cwd)
  }
  return loadExternalConfigResolver(discovered)
}

var legacyConfigDeprecationOnce sync.Once

func emitLegacyConfigDeprecation() {
  legacyConfigDeprecationOnce.Do(func() {
    fmt.Fprintln(os.Stderr, "@ttsc/lint: tsconfig plugin entry \"config\" is deprecated; use \"rules\" for inline severity maps or \"extends\" for a config file path.")
  })
}

func loadExternalConfigResolver(location string) (RuleResolver, error) {
  raw, err := loadConfigFile(location)
  if err != nil {
    return nil, err
  }
  store, err := parseExternalConfigStoreForFile(raw, filepath.Dir(location))
  if err != nil {
    return nil, err
  }
  store.externalConfigPath = location
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
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
      "eslint.config.mts",
      "eslint.config.cts",
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
      return "", fmt.Errorf("@ttsc/lint: multiple lint config files found in %s (%s); set \"extends\" explicitly", dir, strings.Join(names, ", "))
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

func resolveConfigFilePath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

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

func loadConfigFile(location string) (any, error) {
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadJSONConfigFile(location)
  case ".js", ".cjs", ".mjs":
    return loadScriptConfigFile(location)
  case ".ts", ".cts", ".mts":
    return loadTypeScriptConfigFile(location)
  default:
    return nil, fmt.Errorf("@ttsc/lint: unsupported config file extension %q for %s", ext, location)
  }
}

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
  if !isConfigContainer(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object or flat config array", location)
  }
  return out, nil
}

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
  if (value === null || typeof value !== "object") {
    throw new Error("config file must export an object or flat config array");
  }
  process.stdout.write(JSON.stringify(toSerializableConfig(value)));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

function toSerializableConfig(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toSerializableConfig(item));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (isESLintConfigObject(value)) {
    const out = {};
    if (hasESLintRuntimeFields(value)) {
      out.__ttscLintEslintRuntime = true;
    }
    if (Object.prototype.hasOwnProperty.call(value, "basePath")) {
      out.basePath = value.basePath;
    }
    if (Object.prototype.hasOwnProperty.call(value, "extends")) {
      out.extends = toSerializableConfig(value.extends);
    }
    if (Object.prototype.hasOwnProperty.call(value, "files")) {
      out.files = toSerializablePatterns(value.files, "files");
    }
    if (Object.prototype.hasOwnProperty.call(value, "ignores")) {
      out.ignores = toSerializablePatterns(value.ignores, "ignores");
    }
    if (Object.prototype.hasOwnProperty.call(value, "rules")) {
      out.rules = toSerializableRules(value.rules);
    }
    return out;
  }
  return { rules: toSerializableRules(value) };
}

function toSerializableRules(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("rules must be an object");
  }
  return Object.fromEntries(Object.entries(value));
}

function toSerializablePatterns(value, key) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item !== "string") {
        throw new Error(key + "[" + index + "] must be a string");
      }
      return item;
    });
  }
  throw new Error(key + " must be a string or string array");
}

function isESLintConfigObject(value) {
  return [
    "basePath",
    "extends",
    "files",
    "ignores",
    "languageOptions",
    "linterOptions",
    "name",
    "plugins",
    "processor",
    "rules",
    "settings",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasESLintRuntimeFields(value) {
  for (const key of ["languageOptions", "linterOptions", "processor", "settings"]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  }
  if (Object.prototype.hasOwnProperty.call(value, "plugins")) {
    if (!isNativePluginMap(value.plugins)) return true;
  }
  return false;
}

function isNativePluginMap(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entries = Object.values(value);
  if (entries.length === 0) return true;
  for (const entry of entries) {
    if (!isNativePluginValue(entry)) return false;
  }
  return true;
}

function isNativePluginValue(entry) {
  // A non-empty string is a native specifier — JS factory resolves it
  // at load time, so the loader must not flip the ESLint-runtime flag.
  if (typeof entry === "string") return entry.length > 0;
  if (entry === null || typeof entry !== "object") return false;
  let current = entry;
  for (let i = 0; i < 4; i++) {
    if (typeof current.source === "string" && current.source.length > 0) {
      return true;
    }
    if (current.default === null || typeof current.default !== "object") {
      return false;
    }
    current = current.default;
  }
  return false;
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
  if !isConfigContainer(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object or flat config array", location)
  }
  return out, nil
}

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
  if !isConfigContainer(out) {
    return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object or flat config array", location)
  }
  return out, nil
}

func isConfigContainer(value any) bool {
  switch value.(type) {
  case []any, map[string]any:
    return true
  default:
    return false
  }
}

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

func typeScriptConfigLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`import * as importedConfig from %s;

declare const process: {
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  const value = await resolveConfig(importedConfig, true);
  if (!isObject(value)) {
    throw new Error("config file must export an object or flat config array");
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

function toSerializableConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toSerializableConfig(item));
  }
  if (!isObject(value)) {
    return value;
  }
  if (isESLintConfigObject(value)) {
    const out: Record<string, unknown> = {};
    if (hasESLintRuntimeFields(value)) {
      out.__ttscLintEslintRuntime = true;
    }
    if (hasOwn(value, "basePath")) {
      out.basePath = value.basePath;
    }
    if (hasOwn(value, "extends")) {
      out.extends = toSerializableConfig(value.extends);
    }
    if (hasOwn(value, "files")) {
      out.files = toSerializablePatterns(value.files, "files");
    }
    if (hasOwn(value, "ignores")) {
      out.ignores = toSerializablePatterns(value.ignores, "ignores");
    }
    if (hasOwn(value, "rules")) {
      out.rules = toSerializableRules(value.rules);
    }
    return out;
  }
  return { rules: toSerializableRules(value) };
}

function toSerializableRules(value: unknown): Record<string, unknown> {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("rules must be an object");
  }
  return Object.fromEntries(Object.entries(value));
}

function toSerializablePatterns(value: unknown, key: string): string | string[] {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item !== "string") {
        throw new Error(key + "[" + index + "] must be a string");
      }
      return item;
    });
  }
  throw new Error(key + " must be a string or string array");
}

function isESLintConfigObject(value: Record<string, unknown>): boolean {
  return [
    "basePath",
    "extends",
    "files",
    "ignores",
    "languageOptions",
    "linterOptions",
    "name",
    "plugins",
    "processor",
    "rules",
    "settings",
  ].some((key) => hasOwn(value, key));
}

function hasESLintRuntimeFields(value: Record<string, unknown>): boolean {
  for (const key of ["languageOptions", "linterOptions", "processor", "settings"]) {
    if (hasOwn(value, key)) return true;
  }
  if (hasOwn(value, "plugins")) {
    const plugins = value.plugins;
    if (!isNativePluginMap(plugins)) return true;
  }
  return false;
}

// isNativePluginMap reports whether every entry of a plugins map points
// at a ttsc-lint native contributor (an object with a string "source"
// field). Native plugins are compiled into the lint binary at build
// time, so their presence does NOT require the JavaScript ESLint
// runtime; only mixed or pure-ESLint plugin maps do.
function isNativePluginMap(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return true;
  for (const entry of entries) {
    if (!isNativePluginValue(entry)) return false;
  }
  return true;
}

function isNativePluginValue(entry: unknown): boolean {
  // A non-empty string is a native specifier — see the matching Go-side
  // and JS-loader implementations.
  if (typeof entry === "string") return entry.length > 0;
  if (entry === null || typeof entry !== "object") return false;
  // ESM-from-CJS interop wraps CJS modules' "exports.default" so a
  // contributor authored as "export default plugin" lands under a
  // ".default" indirection. Walk a few hops so both "export default"
  // and plain "module.exports = plugin" contributors register as
  // native here.
  let current = entry as Record<string, unknown>;
  for (let i = 0; i < 4; i++) {
    if (typeof current.source === "string" && (current.source as string).length > 0) {
      return true;
    }
    const next = current.default;
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      return false;
    }
    current = next as Record<string, unknown>;
  }
  return false;
}
`, importLiteral)
}

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

func shouldRunTtsxThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

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

func parseExternalSeverity(v any) (Severity, error) {
  if tuple, ok := v.([]any); ok {
    if len(tuple) == 0 {
      return SeverityOff, fmt.Errorf("severity tuple must not be empty")
    }
    return parseSeverity(tuple[0])
  }
  return parseSeverity(v)
}

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

func normalizeGlobPattern(pattern string) string {
  pattern = filepath.ToSlash(pattern)
  pattern = strings.TrimPrefix(pattern, "./")
  if !strings.Contains(pattern, "/") {
    return "**/" + pattern
  }
  return pattern
}

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
