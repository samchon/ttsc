package strip

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
)

// configLoaderTimeout caps every `ttsx`/`node -e` subprocess that evaluates a
// user-supplied strip config. Mirrors the lint package budget: 60 s is generous
// for cold ttsx starts on CI runners and tight enough to keep user-visible
// feedback under a minute.
const configLoaderTimeout = 60 * time.Second

// stripConfigFilenames is the ordered list of candidate filenames that
// findStripConfigFile checks in each directory during upward discovery.
var stripConfigFilenames = []string{
  "strip.config.ts",
  "strip.config.mts",
  "strip.config.cts",
  "strip.config.js",
  "strip.config.mjs",
  "strip.config.cjs",
  "strip.config.json",
}

// allowedTsconfigKeys lists the tsconfig plugin-entry keys that @ttsc/strip
// accepts. Any other key is a hard error.
var allowedTsconfigKeys = map[string]struct{}{
  "configFile": {},
  "enabled":    {},
  "name":       {},
  "stage":      {},
  "transform":  {},
}

// loadStripConfigMap validates the tsconfig plugin entry and loads the strip
// configuration from either an explicit configFile or an auto-discovered
// strip.config.* file. Returns the raw config map ready for parseStrip.
func loadStripConfigMap(pluginConfig map[string]any, cwd, tsconfigPath string) (map[string]any, error) {
  // Reject any key that @ttsc/strip does not recognise. This surfaces
  // stale inline keys (calls, statements) with a clear error so users
  // migrate to a config file instead of silently using defaults.
  for key := range pluginConfig {
    if _, ok := allowedTsconfigKeys[key]; !ok {
      return nil, fmt.Errorf(
        "@ttsc/strip: tsconfig plugin entry contains unsupported key %q; "+
          "strip configuration must be supplied via a strip.config.* file "+
          "(use the \"configFile\" key to point at a custom path)",
        key,
      )
    }
  }

  // Resolve the config file: explicit configFile wins over discovery.
  configFilePath := ""
  if rawCF, ok := pluginConfig["configFile"]; ok {
    cf, ok := rawCF.(string)
    if !ok || strings.TrimSpace(cf) == "" {
      return nil, fmt.Errorf("@ttsc/strip: \"configFile\" must be a non-empty string path")
    }
    configFilePath = resolveStripConfigFilePath(cf, cwd, tsconfigPath)
  } else {
    discovered, err := findStripConfigFile(cwd, tsconfigPath)
    if err != nil {
      return nil, err
    }
    configFilePath = discovered
  }

  // No config file found → use defaults (parseStrip treats an empty map
  // as "apply built-in defaults").
  if configFilePath == "" {
    return map[string]any{}, nil
  }

  raw, err := loadStripConfigFile(configFilePath)
  if err != nil {
    return nil, err
  }
  cfg, ok := raw.(map[string]any)
  if !ok {
    return nil, fmt.Errorf("@ttsc/strip: config file %s must export an object", configFilePath)
  }
  return cfg, nil
}

// findStripConfigFile walks upward from the tsconfig directory (or cwd when no
// tsconfig is set) and returns the first directory that contains exactly one
// strip.config.* file. Multiple candidates in the same directory is an error.
// Returns "" (no error) when the filesystem root is reached without a match.
func findStripConfigFile(cwd, tsconfigPath string) (string, error) {
  dir := stripDiscoveryBaseDir(cwd, tsconfigPath)
  for {
    matches := make([]string, 0, 1)
    for _, name := range stripConfigFilenames {
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
      return "", fmt.Errorf(
        "@ttsc/strip: multiple strip config files found in %s (%s); "+
          "set \"configFile\" explicitly in the tsconfig plugin entry",
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

// stripDiscoveryBaseDir returns the directory from which auto-discovery walks
// upward. Prefers the tsconfig directory over cwd so nested package configs are
// found relative to the tsconfig that triggered the strip run.
func stripDiscoveryBaseDir(cwd, tsconfigPath string) string {
  if tsconfigPath != "" {
    resolved := tsconfigPath
    if !filepath.IsAbs(resolved) {
      resolved = filepath.Join(cwd, resolved)
    }
    return filepath.Dir(resolved)
  }
  return cwd
}

// resolveStripConfigFilePath resolves a user-supplied config path to an
// absolute path. Absolute paths are returned unchanged; relative paths are
// joined to the tsconfig directory (or cwd when no tsconfig is set).
func resolveStripConfigFilePath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(stripDiscoveryBaseDir(cwd, tsconfigPath), configPath)
}

// loadStripConfigFile loads and deserializes a strip config file at location.
// The format is determined by extension: .json is parsed natively; .js/.cjs/.mjs
// run through a Node subprocess; .ts/.cts/.mts run through ttsx.
func loadStripConfigFile(location string) (any, error) {
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadStripJSONConfigFile(location)
  case ".js", ".cjs", ".mjs":
    return loadStripScriptConfigFile(location)
  case ".ts", ".cts", ".mts":
    return loadStripTypeScriptConfigFile(location)
  default:
    return nil, fmt.Errorf("@ttsc/strip: unsupported config file extension %q for %s", ext, location)
  }
}

// loadStripJSONConfigFile reads and JSON-parses a strip config file. A leading
// UTF-8 BOM is stripped before parsing so files saved by Windows editors are
// accepted.
func loadStripJSONConfigFile(location string) (any, error) {
  body, err := os.ReadFile(location)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: read config file %s: %w", location, err)
  }
  body = bytes.TrimPrefix(body, []byte{0xEF, 0xBB, 0xBF})
  var out any
  if err := json.Unmarshal(body, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/strip: parse config file %s: %w", location, err)
  }
  return out, nil
}

// stripScriptLoaderSource is the inline Node.js script used by
// loadStripScriptConfigFile to evaluate a .js/.cjs/.mjs strip config and
// serialize the result to stdout as JSON.
const stripScriptLoaderSource = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  let current = mod;
  for (let i = 0; i < 8; i++) {
    if (current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, "default")) {
      current = current.default;
      continue;
    }
    break;
  }
  const value = typeof current === "function" ? await current() : current;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("strip config file must export an object");
  }
  process.stdout.write(JSON.stringify(value));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`

// loadStripScriptConfigFile evaluates a .js/.cjs/.mjs config file by running a
// Node subprocess that dynamic-imports the file, resolves the default export,
// and serializes the result as JSON to stdout.
func loadStripScriptConfigFile(location string) (any, error) {
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  ctx, cancel := context.WithTimeout(context.Background(), configLoaderTimeout)
  defer cancel()
  cmd := exec.CommandContext(ctx, node, "-e", stripScriptLoaderSource, location)
  cmd.Env = stripNodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf("@ttsc/strip: load config file %s: timed out after %s", location, configLoaderTimeout)
    }
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/strip: load config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/strip: load config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/strip: parse config file %s output: %w", location, err)
  }
  return out, nil
}

// stripTypeScriptLoaderSource returns the TypeScript source of the ephemeral
// loader script that ttsx executes to evaluate a TypeScript strip config file.
// importLiteral must be a JSON-encoded relative import path (e.g.
// `"./strip.config.ts"`) produced by json.Marshal.
func stripTypeScriptLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`import * as importedConfig from %s;

declare const process: {
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  let current: unknown = importedConfig;
  for (let i = 0; i < 8; i++) {
    if (current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current as Record<string, unknown>, "default")) {
      current = (current as Record<string, unknown>).default;
      continue;
    }
    break;
  }
  if (typeof current === "function") {
    current = await (current as () => unknown | Promise<unknown>)();
  }
  if (current === null || typeof current !== "object" || Array.isArray(current)) {
    throw new Error("strip config file must export an object");
  }
  process.stdout.write(JSON.stringify(current));
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}
`, importLiteral)
}

// loadStripTypeScriptConfigFile evaluates a .ts/.cts/.mts config file by writing
// an ephemeral loader script and tsconfig into a temp directory, symlinking the
// nearest node_modules, then running ttsx with a configLoaderTimeout deadline.
//
// The ttsx build runs with `--no-plugins`: the loader only needs to
// type-check and execute the strip config file, so loading the host
// project's transform/check plugins would be wasteful and could fail the
// build against this deliberately lenient loader tsconfig.
func loadStripTypeScriptConfigFile(location string) (any, error) {
  tempDir, err := os.MkdirTemp(stripLoaderTempBase(location, os.TempDir()), "ttsc-strip-config-")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: create config loader tempdir: %w", err)
  }
  defer os.RemoveAll(tempDir)

  if err := stripLinkNearestNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return nil, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importSpecifier, err := stripRelativeImportSpecifier(tempDir, location)
  if err != nil {
    return nil, err
  }
  importLiteral, err := json.Marshal(importSpecifier)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: encode config import %s: %w", location, err)
  }
  if err := os.WriteFile(loader, []byte(stripTypeScriptLoaderSource(string(importLiteral))), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/strip: write config loader: %w", err)
  }
  if err := os.WriteFile(tsconfig, []byte(stripTypeScriptLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/strip: write config loader tsconfig: %w", err)
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
  cmd := stripTtsxCommandContext(ctx, args...)
  cmd.Env = stripNodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return nil, fmt.Errorf("@ttsc/strip: load TypeScript config file %s: timed out after %s", location, configLoaderTimeout)
    }
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/strip: load TypeScript config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/strip: load TypeScript config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/strip: parse TypeScript config file %s output: %w", location, err)
  }
  return out, nil
}

// stripTypeScriptLoaderTsconfig generates the JSON content of the ephemeral
// tsconfig used by the loader script.
func stripTypeScriptLoaderTsconfig(loader, location, outDir string) string {
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
      "rootDir":                         stripLoaderRootDir(outDir),
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

// stripLoaderRootDir returns the widest rootDir that still contains the
// loader tsconfig's inputs: the volume root of the loader temp dir (`C:/` on
// Windows, `/` elsewhere). A literal "/" is not an ancestor of drive-letter
// paths, so tsgo rejects every input with TS6059 (#299, #304). The temp dir
// is created on the same volume as the config file (see stripLoaderTempBase),
// so its volume root spans both `files` entries.
func stripLoaderRootDir(outDir string) string {
  vol := filepath.VolumeName(outDir)
  if vol == "" {
    return "/"
  }
  return filepath.ToSlash(vol + `\`)
}

// stripLoaderTempBase picks the parent directory for the ephemeral
// config-loader tree. The system temp dir is the default, but when it sits on
// a different volume than the config file (Windows: TEMP on `C:`, project on
// `D:`) the loader cannot work from there — no single tsconfig rootDir spans
// two volumes and filepath.Rel cannot produce a relative import across drives
// (#305) — so the tree is created under the config's nearest
// node_modules/.cache instead, falling back to the config's own directory
// when no node_modules exists (or its .cache cannot be created): any location
// on the config's volume beats the system temp dir, which is guaranteed to
// fail. Returns "" (the os.MkdirTemp default) when the volumes already match.
func stripLoaderTempBase(location, systemTemp string) string {
  // A relative location has no volume; "" must not be read as "a volume
  // other than the system temp's" — it keeps the historical default (and
  // the Rel-failure contract for relative config paths).
  vol := filepath.VolumeName(location)
  if vol == "" || strings.EqualFold(filepath.VolumeName(systemTemp), vol) {
    return ""
  }
  nodeModules := stripFindNearestNodeModules(filepath.Dir(location))
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
  base := filepath.Join(stripResolveDirLink(nodeModules), ".cache")
  if err := os.MkdirAll(base, 0o755); err != nil {
    return filepath.Dir(location)
  }
  real, err := filepath.EvalSymlinks(base)
  if err != nil || !strings.EqualFold(filepath.VolumeName(real), filepath.VolumeName(location)) {
    return filepath.Dir(location)
  }
  return real
}

// stripResolveDirLink chases a directory that is itself a symlink or NTFS junction
// to its target (bounded against link cycles). os.Readlink is the probe:
// it resolves junctions, which report neither ModeSymlink nor an
// EvalSymlinks-traversable path.
func stripResolveDirLink(dir string) string {
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

// stripTtsxCommandContext returns an exec.Cmd that runs ttsx with the given
// arguments, routing through node when the resolved binary is a script file.
func stripTtsxCommandContext(ctx context.Context, args ...string) *exec.Cmd {
  ttsx := os.Getenv("TTSC_TTSX_BINARY")
  if ttsx == "" {
    ttsx = "ttsx"
  }
  if stripShouldRunThroughNode(ttsx) {
    node := os.Getenv("TTSC_NODE_BINARY")
    if node == "" {
      node = "node"
    }
    return exec.CommandContext(ctx, node, append([]string{ttsx}, args...)...)
  }
  return exec.CommandContext(ctx, ttsx, args...)
}

// stripShouldRunThroughNode reports whether the resolved ttsx binary is a
// script (JS or TS extension) that must be executed via node.
func stripShouldRunThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

// stripNodeConfigLoaderEnv builds the environment for a Node.js config-loader
// subprocess. Prepends the nearest node_modules to NODE_PATH so imports in
// .js/.cjs/.mjs config files resolve correctly.
func stripNodeConfigLoaderEnv(location string) []string {
  env := os.Environ()
  parts := make([]string, 0, 2)
  if nodeModules := stripFindNearestNodeModules(filepath.Dir(location)); nodeModules != "" {
    parts = append(parts, nodeModules)
  }
  if existing := os.Getenv("NODE_PATH"); existing != "" {
    parts = append(parts, existing)
  }
  if len(parts) == 0 {
    return env
  }
  return stripSetEnv(env, "NODE_PATH", strings.Join(parts, string(os.PathListSeparator)))
}

// stripFindNearestNodeModules walks upward from start and returns the first
// node_modules directory found, or "" when the filesystem root is reached.
func stripFindNearestNodeModules(start string) string {
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

// stripLinkNearestNodeModules creates a node_modules symlink (or Windows
// junction) inside tempDir pointing at the nearest node_modules upward from
// sourceDir. No-op when no node_modules is found.
func stripLinkNearestNodeModules(tempDir, sourceDir string) error {
  nodeModules := stripFindNearestNodeModules(sourceDir)
  if nodeModules == "" {
    return nil
  }
  link := filepath.Join(tempDir, "node_modules")
  err := os.Symlink(nodeModules, link)
  if err == nil {
    return nil
  }
  if runtime.GOOS == "windows" {
    jerr := stripCreateWindowsJunction(link, nodeModules)
    if jerr == nil {
      return nil
    }
    err = fmt.Errorf("%w (junction fallback: %v)", err, jerr)
  }
  return fmt.Errorf("@ttsc/strip: link config node_modules %s: %w", nodeModules, err)
}

// stripCreateWindowsJunction creates a directory junction on Windows.
func stripCreateWindowsJunction(link, target string) error {
  cmd := exec.Command("cmd", "/c", "mklink", "/J", link, target)
  if out, err := cmd.CombinedOutput(); err != nil {
    return fmt.Errorf("mklink /J failed: %v: %s", err, strings.TrimSpace(string(out)))
  }
  return nil
}

// stripRelativeImportSpecifier computes the ESM import specifier for location
// relative to fromDir, always prefixed with "./" or "../".
func stripRelativeImportSpecifier(fromDir, location string) (string, error) {
  relative, err := filepath.Rel(fromDir, location)
  if err != nil {
    return "", fmt.Errorf("@ttsc/strip: resolve relative config import %s: %w", location, err)
  }
  relative = filepath.ToSlash(relative)
  if strings.HasPrefix(relative, "../") || strings.HasPrefix(relative, "./") {
    return relative, nil
  }
  return "./" + relative, nil
}

// stripSetEnv updates an existing key=value entry in env (in-place) or appends
// a new one.
func stripSetEnv(env []string, key, value string) []string {
  prefix := key + "="
  for i, entry := range env {
    if strings.HasPrefix(entry, prefix) {
      env[i] = prefix + value
      return env
    }
  }
  return append(env, prefix+value)
}
