package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

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
// `Config` carries the tsconfig plugin entry. `Mode` and `Name` come from
// the native descriptor.
type PluginEntry struct {
	Config          map[string]any `json:"config"`
	ContractVersion int            `json:"contractVersion"`
	Mode            string         `json:"mode"`
	Name            string         `json:"name"`
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

// FindLintEntry returns the lint entry only when it is the first active
// plugin. Linting after a source-transforming plugin would inspect mutated
// source, which is not a meaningful user-code lint result.
func FindLintEntry(entries []PluginEntry) (*PluginEntry, error) {
	for i := range entries {
		if entries[i].Mode == "ttsc-lint" {
			if i != 0 {
				return nil, fmt.Errorf("@ttsc/lint must be the first active compilerOptions.plugins entry")
			}
			return &entries[i], nil
		}
	}
	return nil, nil
}

// RuleConfig captures the resolved per-rule severity. The map is keyed by
// rule name (e.g. "no-var").
type RuleConfig map[string]Severity

// ParseRules normalizes the rules map from a tsconfig plugin entry.
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

// LoadRuleConfig resolves the lint config for one plugin entry. The only
// accepted lint-specific tsconfig key is `config`; it may be either an inline
// rules object or a string path to a standalone config file. Relative config
// paths are resolved from the tsconfig directory.
func LoadRuleConfig(entry *PluginEntry, cwd, tsconfigPath string) (RuleConfig, error) {
	if entry == nil {
		return RuleConfig{}, nil
	}
	inline := entry.Config
	if inline == nil {
		inline = map[string]any{}
	}
	for _, key := range []string{"rules", "configFile", "configPath"} {
		if _, ok := inline[key]; ok {
			return nil, fmt.Errorf("@ttsc/lint: %q is not supported; use \"config\"", key)
		}
	}

	value, ok := inline["config"]
	if !ok {
		return RuleConfig{}, nil
	}
	switch typed := value.(type) {
	case string:
		if strings.TrimSpace(typed) == "" {
			return nil, fmt.Errorf("@ttsc/lint: \"config\" must not be empty")
		}
		rules, err := loadConfigFile(resolveConfigFilePath(typed, cwd, tsconfigPath))
		if err != nil {
			return nil, err
		}
		return ParseRules(rules)
	case map[string]any:
		return ParseRules(typed)
	default:
		return nil, fmt.Errorf("@ttsc/lint: \"config\" must be a string path or object, got %T", value)
	}
}

func resolveConfigFilePath(configPath, cwd, tsconfigPath string) string {
	if filepath.IsAbs(configPath) {
		return configPath
	}
	base := cwd
	if tsconfigPath != "" {
		resolvedTsconfig := tsconfigPath
		if !filepath.IsAbs(resolvedTsconfig) {
			resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
		}
		base = filepath.Dir(resolvedTsconfig)
	}
	return filepath.Join(base, configPath)
}

func loadConfigFile(location string) (map[string]any, error) {
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

func loadJSONConfigFile(location string) (map[string]any, error) {
	body, err := os.ReadFile(location)
	if err != nil {
		return nil, fmt.Errorf("@ttsc/lint: read config file %s: %w", location, err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("@ttsc/lint: parse config file %s: %w", location, err)
	}
	if out == nil {
		return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object", location)
	}
	return out, nil
}

func loadScriptConfigFile(location string) (map[string]any, error) {
	const script = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  const candidate = mod.default ?? mod.config ?? mod;
  const value = typeof candidate === "function" ? await candidate() : candidate;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("config file must export an object");
  }
  process.stdout.write(JSON.stringify(value));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`
	node := os.Getenv("TTSC_NODE_BINARY")
	if node == "" {
		node = "node"
	}
	cmd := exec.Command(node, "-e", script, location)
	output, err := cmd.Output()
	if err != nil {
		stderr := ""
		if exit, ok := err.(*exec.ExitError); ok {
			stderr = strings.TrimSpace(string(exit.Stderr))
		}
		if stderr != "" {
			return nil, fmt.Errorf("@ttsc/lint: load config file %s: %s", location, stderr)
		}
		return nil, fmt.Errorf("@ttsc/lint: load config file %s: %w", location, err)
	}
	var out map[string]any
	if err := json.Unmarshal(output, &out); err != nil {
		return nil, fmt.Errorf("@ttsc/lint: parse config file %s output: %w", location, err)
	}
	if out == nil {
		return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object", location)
	}
	return out, nil
}

func loadTypeScriptConfigFile(location string) (map[string]any, error) {
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

	cmd := ttsxCommand(args...)
	cmd.Env = nodeConfigLoaderEnv(location)
	output, err := cmd.Output()
	if err != nil {
		stderr := ""
		if exit, ok := err.(*exec.ExitError); ok {
			stderr = strings.TrimSpace(string(exit.Stderr))
		}
		if stderr != "" {
			return nil, fmt.Errorf("@ttsc/lint: load TypeScript config file %s: %s", location, stderr)
		}
		return nil, fmt.Errorf("@ttsc/lint: load TypeScript config file %s: %w", location, err)
	}
	var out map[string]any
	if err := json.Unmarshal(output, &out); err != nil {
		return nil, fmt.Errorf("@ttsc/lint: parse TypeScript config file %s output: %w", location, err)
	}
	if out == nil {
		return nil, fmt.Errorf("@ttsc/lint: config file %s must export an object", location)
	}
	return out, nil
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
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("config file must export an object");
  }
  process.stdout.write(JSON.stringify(value));
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
`, importLiteral)
}

func typeScriptConfigLoaderTsconfig(loader, location, outDir string) string {
	content := map[string]any{
		"compilerOptions": map[string]any{
			"allowImportingTsExtensions":      true,
			"module":                          "ESNext",
			"moduleResolution":                "bundler",
			"outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
			"rewriteRelativeImportExtensions": true,
			"rootDir":                         "/",
			"skipLibCheck":                    true,
			"strict":                          true,
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
	ttsx := os.Getenv("TTSC_TTSX_BINARY")
	if ttsx == "" {
		ttsx = "ttsx"
	}
	if shouldRunTtsxThroughNode(ttsx) {
		node := os.Getenv("TTSC_NODE_BINARY")
		if node == "" {
			node = "node"
		}
		return exec.Command(node, append([]string{ttsx}, args...)...)
	}
	return exec.Command(ttsx, args...)
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
	if err := os.Symlink(nodeModules, link); err != nil {
		return fmt.Errorf("@ttsc/lint: link config node_modules %s: %w", nodeModules, err)
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
		return SeverityOff, fmt.Errorf("unknown severity %q (want off | warning | error)", x)
	case float64:
		switch x {
		case 0:
			return SeverityOff, nil
		case 1:
			return SeverityWarn, nil
		case 2:
			return SeverityError, nil
		}
		return SeverityOff, fmt.Errorf("unknown severity %v (want off | warning | error)", x)
	}
	return SeverityOff, fmt.Errorf("severity must be one of: off | warning | error, got %T", v)
}

// Severity returns the configured level for a rule, defaulting to
// `SeverityOff`. Rules opt in explicitly — silent on missing entries.
func (c RuleConfig) Severity(name string) Severity {
	if c == nil {
		return SeverityOff
	}
	return c[name]
}
