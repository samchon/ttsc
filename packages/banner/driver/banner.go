package banner

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// configLoaderTimeout caps subprocesses that evaluate user-supplied banner
// config files. This matches the strip/lint loaders so a hanging config does
// not block the compiler indefinitely.
const configLoaderTimeout = 60 * time.Second

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

// frameworkKeys lists the tsconfig plugin-entry keys that the ttsc host
// framework owns. They are accepted without error; all other keys are rejected.
var frameworkKeys = map[string]struct{}{
  "enabled":   {},
  "name":      {},
  "stage":     {},
  "transform": {},
}

// validateBannerConfig rejects any tsconfig plugin entry key that is not a
// known framework key and is not the single banner-specific "configFile" key.
func validateBannerConfig(config map[string]any) error {
  for key := range config {
    if _, ok := frameworkKeys[key]; ok {
      continue
    }
    if key == "configFile" {
      continue
    }
    return fmt.Errorf(
      "@ttsc/banner: tsconfig plugin entry contains unsupported key %q. "+
        "Banner options must be placed in a banner.config.{ts,cts,mts,js,cjs,mjs,json} file. "+
        "The only accepted key in the tsconfig entry is \"configFile\" (optional path to the config file).",
      key,
    )
  }
  return nil
}

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
// The config entry is validated first: only the "configFile" key (plus
// framework keys) is accepted. When "configFile" is present its value is
// resolved to an absolute path and loaded. When absent the upward-walk
// discovery is used. Returns an error when the config is invalid or when
// no banner text can be found.
func resolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error) {
  if err := validateBannerConfig(config); err != nil {
    return "", err
  }

  if rawConfigFile, ok := config["configFile"]; ok {
    configFile, ok := rawConfigFile.(string)
    if !ok || strings.TrimSpace(configFile) == "" {
      return "", fmt.Errorf("@ttsc/banner: \"configFile\" must be a non-empty string path")
    }
    location := resolveBannerConfigPath(configFile, cwd, tsconfigPath)
    raw, err := loadBannerConfigFile(location)
    if err != nil {
      return "", err
    }
    text, ok, err := bannerTextFromConfigValue(raw, filepath.Base(location))
    if err != nil {
      return "", err
    }
    if !ok {
      return "", fmt.Errorf("@ttsc/banner: %s must export an object with a non-empty \"text\" string", location)
    }
    return text, nil
  }

  location, err := findBannerConfigFile(cwd, tsconfigPath)
  if err != nil {
    return "", err
  }
  if location == "" {
    return "", fmt.Errorf("@ttsc/banner: no banner.config.{ts,cts,mts,js,cjs,mjs,json} file found; create one or set \"configFile\" in the tsconfig plugin entry")
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
    return "", fmt.Errorf("@ttsc/banner: %s must export an object with a non-empty \"text\" string", location)
  }
  return text, nil
}

// bannerTextFromConfigValue extracts a banner text string from a config value.
// A banner config value must be an object with a non-empty "text" string; raw
// may also be nil (not present). Returns (text, true, nil) on success,
// ("", false, nil) when absent, or ("", true, err) on a type mismatch. label is
// used in error messages and is the config file's base name (e.g.
// "banner.config.json").
func bannerTextFromConfigValue(raw any, label string) (string, bool, error) {
  if raw == nil {
    return "", false, nil
  }
  object, ok := raw.(map[string]any)
  if !ok {
    return "", true, fmt.Errorf("@ttsc/banner: %s must be an object with a non-empty \"text\" string", label)
  }
  rawText, ok := object["text"]
  if !ok {
    return "", false, nil
  }
  text, ok := rawText.(string)
  if !ok || strings.TrimSpace(text) == "" {
    return "", true, fmt.Errorf("@ttsc/banner: %s.text must be a non-empty string", label)
  }
  return text, true, nil
}

// findBannerConfigFile walks up from the tsconfig (or cwd) directory looking for
// a banner.config.{ts,cts,mts,js,cjs,mjs,json} file. Returns the path when exactly
// one match is found per directory, "" when none exists at any level, or an
// error when multiple candidates exist in the same directory.
func findBannerConfigFile(cwd, tsconfigPath string) (string, error) {
  dir := tsconfigBaseDir(cwd, tsconfigPath)
  for {
    matches := make([]string, 0, 1)
    for _, name := range []string{
      "banner.config.json",
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
      names := make([]string, len(matches))
      for i, match := range matches {
        names[i] = filepath.Base(match)
      }
      return "", fmt.Errorf(
        "@ttsc/banner: multiple banner config files found in %s (%s); set \"configFile\" explicitly in the tsconfig plugin entry",
        dir, strings.Join(names, ", "),
      )
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

// tsconfigBaseDir returns the base directory both for resolving an explicit
// `configFile` path and for starting the upward banner-config-file search.
// The launcher's explicit project-root channel (driver.PluginConfigDirEnv)
// wins when set — the tsconfig may be a generated wrapper in a temp directory
// that no longer identifies the project — otherwise the directory containing
// the tsconfig is used, falling back to cwd when tsconfigPath is empty.
func tsconfigBaseDir(cwd, tsconfigPath string) string {
  return driver.PluginConfigBaseDir(cwd, tsconfigPath)
}

// loadBannerConfigFile loads and evaluates a banner config file, returning its
// exported value as a Go any. A valid banner config exports an object with a
// "text" string; the value is validated by bannerTextFromConfigValue. The file
// must be named banner.config.{ts,cts,mts,js,cjs,mjs,json}; JS/CJS/MJS variants
// run under Node, TypeScript variants compile and run via ttsx in a temp
// directory, and JSON files are parsed natively.
func loadBannerConfigFile(location string) (any, error) {
  if !isBannerConfigFileName(filepath.Base(location)) {
    return nil, fmt.Errorf("@ttsc/banner: config file must be named banner.config.{ts,cts,mts,js,cjs,mjs,json}: %s", location)
  }
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadBannerJSONConfigFile(location)
  case ".js", ".cjs", ".mjs":
    return loadBannerScriptConfigFile(location)
  }
  return loadBannerTypeScriptConfigFile(location)
}

// isBannerConfigFileName reports whether name is an allowed banner config file name.
func isBannerConfigFileName(name string) bool {
  switch name {
  case "banner.config.json",
    "banner.config.js",
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

// loadBannerJSONConfigFile reads and JSON-parses a banner config file. A leading
// UTF-8 BOM is stripped before parsing so files saved by Windows editors are
// accepted. The parsed value must be an object with a non-empty "text" string.
func loadBannerJSONConfigFile(location string) (any, error) {
  body, err := os.ReadFile(location)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/banner: read config file %s: %w", location, err)
  }
  // Strip a leading UTF-8 BOM so files saved by Windows editors round
  // trip through json.Unmarshal without an opaque "invalid character" failure.
  body = bytes.TrimPrefix(body, []byte{0xEF, 0xBB, 0xBF})
  var out any
  if err := json.Unmarshal(body, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: parse config file %s: %w", location, err)
  }
  return out, nil
}

// loadBannerScriptConfigFile evaluates a JS/CJS/MJS banner config file by
// running a small Node.js loader script that dynamic-imports the file and
// serializes its exported value to stdout as JSON.
func loadBannerScriptConfigFile(location string) (any, error) {
  const script = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  let current = Object.prototype.hasOwnProperty.call(mod, "default") ? mod.default : mod;
  for (let i = 0; i < 8; i++) {
    if (current !== null && typeof current === "object" && typeof current.text === "string") {
      break;
    }
    if (current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, "default")) {
      current = current.default;
      continue;
    }
    break;
  }
  const value = typeof current === "function" ? await current() : current;
  process.stdout.write(JSON.stringify(toSerializableBanner(value)));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

function toSerializableBanner(value) {
  if (value !== null && typeof value === "object" && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export an object with a non-empty \"text\" string");
}
`
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  ctx, cancel := context.WithTimeout(context.Background(), configLoaderTimeout)
  defer cancel()
  cmd := exec.CommandContext(ctx, node, "-e", script, location)
  cmd.Env = nodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf("@ttsc/banner: load config file %s: timed out after %s", location, configLoaderTimeout)
    }
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
// is created so the config file can import its own dependencies. The ttsx
// build runs with `--no-plugins` so evaluating the config never triggers the
// host project's transform/check plugins against the loader tsconfig.
func loadBannerTypeScriptConfigFile(location string) (any, error) {
  tempDir, err := os.MkdirTemp(loaderTempBase(location, os.TempDir()), "ttsc-banner-config-")
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
      return nil, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: timed out after %s", location, configLoaderTimeout)
    }
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
  let current = isObject(value) && hasOwn(value, "default") ? value.default : value;
  for (let i = 0; i < 8; i++) {
    if (isBannerObject(current)) {
      break;
    }
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

function isBannerObject(value: unknown): value is { text: string } {
  return isObject(value) && typeof value.text === "string";
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toSerializableBanner(value: unknown): unknown {
  if (isObject(value) && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export an object with a non-empty \"text\" string");
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
      "rootDir":                         loaderRootDir(outDir),
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

// loaderRootDir returns the widest rootDir that still contains the loader
// tsconfig's inputs: the volume root of the loader temp dir (`C:/` on
// Windows, `/` elsewhere). A literal "/" is not an ancestor of drive-letter
// paths, so tsgo rejects every input with TS6059 (#299, #304). The temp dir
// is created on the same volume as the config file (see loaderTempBase), so
// its volume root spans both `files` entries.
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

// ttsxCommand builds an exec.Cmd that runs ttsx with the given args.
// When TTSC_TTSX_BINARY has a script extension (.js, .ts, …) the binary is
// invoked via the Node runtime so it is executed correctly on all platforms.
func ttsxCommand(args ...string) *exec.Cmd {
  return ttsxCommandContext(context.Background(), args...)
}

// ttsxCommandContext is the timeout-aware variant used by config loaders.
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
  err := os.Symlink(nodeModules, link)
  if err == nil {
    return nil
  }
  if runtime.GOOS == "windows" {
    jerr := createWindowsJunction(link, nodeModules)
    if jerr == nil {
      return nil
    }
    err = fmt.Errorf("%w (junction fallback: %v)", err, jerr)
  }
  return fmt.Errorf("@ttsc/banner: link config node_modules %s: %w", nodeModules, err)
}

// createWindowsJunction creates a directory junction on Windows.
func createWindowsJunction(link, target string) error {
  cmd := exec.Command("cmd", "/c", "mklink", "/J", link, target)
  if out, err := cmd.CombinedOutput(); err != nil {
    return fmt.Errorf("mklink /J failed: %v: %s", err, strings.TrimSpace(string(out)))
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
