package banner

import (
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func init() {
  driver.RegisterPlugin(plugin{})
}

// plugin implements driver.SourcePreamblePlugin for @ttsc/banner.
type plugin struct{}

var (
  // linkConfigNodeModules is overridable in tests to avoid real symlink creation.
  linkConfigNodeModules = linkNearestNodeModules
  // writeConfigLoaderFile is overridable in tests to avoid real file I/O.
  writeConfigLoaderFile = os.WriteFile
)

// SourcePreamble resolves the banner text from the plugin config and returns it
// formatted as a JSDoc block comment suitable for prepending to each emitted file.
func (plugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  return parseBanner(ctx.Entry.Config, ctx.Cwd, ctx.Tsconfig)
}

// parseBanner resolves and formats banner text into a JSDoc block comment.
// Trailing blank lines are stripped from the resolved text before formatting.
func parseBanner(config map[string]any, cwd, tsconfigPath string) (string, error) {
  text, err := resolveBannerText(config, cwd, tsconfigPath)
  if err != nil {
    return "", err
  }
  lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
  for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
    lines = lines[:len(lines)-1]
  }
  var b strings.Builder
  sep := strings.Repeat("-", 64)
  b.WriteString("/**\n")
  b.WriteString(" * ")
  b.WriteString(sep)
  b.WriteByte('\n')
  for _, line := range lines {
    b.WriteString(" * ")
    b.WriteString(sanitizeJSDocLine(line))
    b.WriteByte('\n')
  }
  b.WriteString(" *\n")
  b.WriteString(" * @packageDocumentation\n ")
  b.WriteString("*/\n")
  return b.String(), nil
}

// resolveBannerText extracts the banner text from the plugin config.
// It tries, in order: inline "text" key, explicit "config" path, auto-discovered
// banner.config.* file. Returns an error when none of these sources provides text.
func resolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error) {
  if text, ok, err := bannerTextFromConfigValue(config["text"], `"text"`); ok || err != nil {
    return text, err
  }
  if rawConfigPath, ok := config["config"]; ok {
    configPath, ok := rawConfigPath.(string)
    if !ok || strings.TrimSpace(configPath) == "" {
      return "", fmt.Errorf("@ttsc/banner: \"config\" must be a non-empty string path")
    }
    location := resolveBannerConfigPath(configPath, cwd, tsconfigPath)
    raw, err := loadBannerConfigFile(location)
    if err != nil {
      return "", err
    }
    text, ok, err := bannerTextFromConfigValue(raw, filepath.Base(location))
    if err != nil {
      return "", err
    }
    if !ok {
      return "", fmt.Errorf("@ttsc/banner: %s must export a non-empty string or an object with a non-empty \"text\" string", location)
    }
    return text, nil
  }
  location, err := findBannerConfigFile(cwd, tsconfigPath)
  if err != nil {
    return "", err
  }
  if location == "" {
    return "", fmt.Errorf("@ttsc/banner: \"text\" must be a non-empty string or a banner.config.{js,cjs,mjs,ts,mts,cts} file must exist")
  }
  raw, err := loadBannerConfigFile(location)
  if err != nil {
    return "", err
  }
  text, ok, err := bannerTextFromConfigValue(raw, filepath.Base(location))
  if err != nil {
    return "", err
  }
  if !ok {
    return "", fmt.Errorf("@ttsc/banner: %s must export a non-empty string or an object with a non-empty \"text\" string", location)
  }
  return text, nil
}

// bannerTextFromConfigValue extracts a banner text string from a config value.
// raw may be a string, a map with a "text" key, or nil (not present).
// Returns (text, true, nil) on success, ("", false, nil) when absent, or
// ("", true, err) / ("", false, err) on a type mismatch. label is used in
// error messages and should describe the config source (e.g. "\"text\"").
func bannerTextFromConfigValue(raw any, label string) (string, bool, error) {
  if raw == nil {
    return "", false, nil
  }
  text, ok := raw.(string)
  if ok {
    if strings.TrimSpace(text) == "" {
      return "", true, fmt.Errorf("@ttsc/banner: %s must be a non-empty string", label)
    }
    return text, true, nil
  }
  object, ok := raw.(map[string]any)
  if !ok {
    return "", true, fmt.Errorf("@ttsc/banner: %s must be a string or an object with a non-empty \"text\" string", label)
  }
  rawText, ok := object["text"]
  if !ok {
    return "", false, nil
  }
  text, ok = rawText.(string)
  if !ok || strings.TrimSpace(text) == "" {
    return "", true, fmt.Errorf("@ttsc/banner: %s.text must be a non-empty string", label)
  }
  return text, true, nil
}

// findBannerConfigFile walks up from the tsconfig (or cwd) directory looking for
// a banner.config.{js,cjs,mjs,ts,cts,mts} file. Returns the path when exactly
// one match is found per directory, "" when none exists at any level, or an
// error when multiple candidates exist in the same directory.
func findBannerConfigFile(cwd, tsconfigPath string) (string, error) {
  dir := discoveryConfigBaseDir(cwd, tsconfigPath)
  for {
    matches := make([]string, 0, 1)
    for _, name := range []string{
      "banner.config.js",
      "banner.config.cjs",
      "banner.config.mjs",
      "banner.config.ts",
      "banner.config.cts",
      "banner.config.mts",
    } {
      candidate := filepath.Join(dir, name)
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        matches = append(matches, candidate)
      }
    }
    if len(matches) > 1 {
      return "", fmt.Errorf("@ttsc/banner: multiple banner.config.* files found in %s", dir)
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

// resolveBannerConfigPath resolves a config path from the plugin entry.
// Absolute paths are returned as-is; relative paths are resolved against the
// tsconfig directory (or cwd when no tsconfig is set).
func resolveBannerConfigPath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

// tsconfigBaseDir returns the directory that contains the tsconfig file, or cwd
// when tsconfigPath is empty. Used as the base for resolving explicit config paths.
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

// discoveryConfigBaseDir returns the starting directory for the upward banner
// config file search. Semantically identical to tsconfigBaseDir; kept separate
// to make the call sites self-documenting.
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

// loadBannerConfigFile loads and evaluates a banner config file, returning its
// exported value as a Go any (string or map[string]any). The file must be named
// banner.config.{js,cjs,mjs,ts,cts,mts}; JS/CJS/MJS variants run under Node,
// TypeScript variants compile and run via ttsx in a temp directory.
func loadBannerConfigFile(location string) (any, error) {
  if !isBannerConfigFileName(filepath.Base(location)) {
    return nil, fmt.Errorf("@ttsc/banner: config file must be named banner.config.{js,cjs,mjs,ts,mts,cts}: %s", location)
  }
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".js", ".cjs", ".mjs":
    return loadBannerScriptConfigFile(location)
  }
  return loadBannerTypeScriptConfigFile(location)
}

// isBannerConfigFileName reports whether name is an allowed banner config file name.
func isBannerConfigFileName(name string) bool {
  switch name {
  case "banner.config.js",
    "banner.config.cjs",
    "banner.config.mjs",
    "banner.config.ts",
    "banner.config.cts",
    "banner.config.mts":
    return true
  default:
    return false
  }
}

// loadBannerScriptConfigFile evaluates a JS/CJS/MJS banner config file by
// running a small Node.js loader script that dynamic-imports the file and
// serializes its exported value to stdout as JSON.
func loadBannerScriptConfigFile(location string) (any, error) {
  const script = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  const candidate = Object.prototype.hasOwnProperty.call(mod, "default") ? mod.default : mod;
  const value = typeof candidate === "function" ? await candidate() : candidate;
  process.stdout.write(JSON.stringify(toSerializableBanner(value)));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

function toSerializableBanner(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value !== null && typeof value === "object" && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export a string or an object with a text string");
}
`
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  cmd := exec.Command(node, "-e", script, location)
  cmd.Env = nodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/banner: load config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/banner: load config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: parse config file %s output: %w", location, err)
  }
  return out, nil
}

// loadBannerTypeScriptConfigFile compiles and runs a TypeScript banner config
// file using ttsx in a temp directory. A symlink to the nearest node_modules
// is created so the config file can import its own dependencies.
func loadBannerTypeScriptConfigFile(location string) (any, error) {
  tempDir, err := os.MkdirTemp("", "ttsc-banner-config-")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/banner: create config loader tempdir: %w", err)
  }
  defer os.RemoveAll(tempDir)

  if err := linkConfigNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return nil, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importSpecifier, err := relativeImportSpecifier(tempDir, location)
  if err != nil {
    return nil, err
  }
  importLiteral, _ := json.Marshal(importSpecifier)
  if err := writeConfigLoaderFile(loader, []byte(bannerTypeScriptConfigLoaderSource(string(importLiteral))), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: write config loader: %w", err)
  }
  if err := writeConfigLoaderFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: write config loader tsconfig: %w", err)
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
      return nil, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: parse TypeScript config file %s output: %w", location, err)
  }
  return out, nil
}

// relativeImportSpecifier returns a "./" or "../"-prefixed slash-separated
// import specifier for location relative to fromDir.
func relativeImportSpecifier(fromDir, location string) (string, error) {
  relative, err := filepath.Rel(fromDir, location)
  if err != nil {
    return "", fmt.Errorf("@ttsc/banner: resolve relative config import %s: %w", location, err)
  }
  relative = filepath.ToSlash(relative)
  if strings.HasPrefix(relative, "../") || strings.HasPrefix(relative, "./") {
    return relative, nil
  }
  return "./" + relative, nil
}

// bannerTypeScriptConfigLoaderSource returns the source of a TypeScript loader
// module that imports the banner config file specified by importLiteral (a
// JSON-encoded import specifier) and writes the serialized banner value to stdout.
func bannerTypeScriptConfigLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`import * as importedConfig from %s;

declare const process: {
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  const value = await resolveConfig(importedConfig);
  process.stdout.write(JSON.stringify(toSerializableBanner(value)));
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}

async function resolveConfig(value: unknown): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (isObject(current) && hasOwn(current, "default")) {
      current = current.default;
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

function toSerializableBanner(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }
  if (isObject(value) && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export a string or an object with a text string");
}
`, importLiteral)
}

// typeScriptConfigLoaderTsconfig returns the JSON content of a tsconfig that
// compiles loader and location together so ttsx can execute the loader.
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
  body, _ := json.MarshalIndent(content, "", "  ")
  return string(body)
}

// ttsxCommand builds an exec.Cmd that runs ttsx with the given args.
// When TTSC_TTSX_BINARY has a script extension (.js, .ts, …) the binary is
// invoked via the Node runtime so it is executed correctly on all platforms.
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

// shouldRunTtsxThroughNode reports whether binary has a script file extension
// and therefore must be launched via node rather than executed directly.
func shouldRunTtsxThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

// nodeConfigLoaderEnv builds an environment slice for the config-loader Node
// process. It prepends the nearest node_modules directory to NODE_PATH so
// the config file can resolve its own package dependencies.
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

// linkNearestNodeModules creates a node_modules symlink inside tempDir pointing
// to the nearest node_modules ancestor of sourceDir. Does nothing when none is found.
func linkNearestNodeModules(tempDir, sourceDir string) error {
  nodeModules := findNearestNodeModules(sourceDir)
  if nodeModules == "" {
    return nil
  }
  link := filepath.Join(tempDir, "node_modules")
  if err := os.Symlink(nodeModules, link); err != nil {
    return fmt.Errorf("@ttsc/banner: link config node_modules %s: %w", nodeModules, err)
  }
  return nil
}

// findNearestNodeModules walks up from start looking for a node_modules directory.
// Returns the absolute path of the first match, or "" when none is found.
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

// setEnv returns a copy of env with key=value. If key already exists in env,
// its value is updated in-place; otherwise the entry is appended.
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

// sanitizeJSDocLine escapes any JSDoc-closing sequence in a banner text line
// by replacing "*/" with "* /" so the generated block comment stays valid.
func sanitizeJSDocLine(line string) string {
  return strings.ReplaceAll(line, "*/", "* /")
}
