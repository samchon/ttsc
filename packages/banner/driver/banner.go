package banner

import (
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
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
  preamble, err := parseBannerWithReporters(ctx.Entry.Config, ctx.Cwd, ctx.Tsconfig, ctx.ReportHostInput, ctx.ReportHostInputHash, ctx.ReportHostInputRealpath)
  if err != nil {
    return "", err
  }
  // Every file receives the same text, and that text comes from
  // banner.config.* alone — including, for a script or TypeScript config, every
  // module the loader pulled in, each of which was reported above as a host
  // input. Host inputs stay universal under the completeness contract, so a
  // config edit still invalidates every file while an unrelated type edit stops
  // doing so (samchon/ttsc#1263).
  ctx.ReportDependenciesComplete()
  return preamble, nil
}

// parseBanner resolves and formats banner text into a JSDoc block comment.
// Trailing blank lines are stripped from the resolved text before formatting.
func parseBanner(config map[string]any, cwd, tsconfigPath string) (string, error) {
  return parseBannerWithReporter(config, cwd, tsconfigPath, nil)
}

func parseBannerWithReporter(config map[string]any, cwd, tsconfigPath string, reporter func(string)) (string, error) {
  return parseBannerWithReporters(config, cwd, tsconfigPath, reporter, nil, nil)
}

func parseBannerWithReporters(config map[string]any, cwd, tsconfigPath string, reporter func(string), hashReporter func(string, *string), realpathReporter func(string, *string)) (string, error) {
  text, err := resolveBannerTextWithReporters(config, cwd, tsconfigPath, reporter, hashReporter, realpathReporter)
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

// sanitizeJSDocLine escapes any JSDoc-closing sequence in a banner text line
// by replacing "*/" with "* /" so the generated block comment stays valid.
func sanitizeJSDocLine(line string) string {
  return strings.ReplaceAll(line, "*/", "* /")
}

// resolveBannerText extracts the banner text from the plugin config.
// The config entry is validated first: only the "configFile" key (plus
// framework keys) is accepted. When "configFile" is present its value is
// resolved to an absolute path and loaded. When absent the upward-walk
// discovery is used. Returns an error when the config is invalid or when
// no banner text can be found.
//
// The discovery base directory doubles as the resolution root the config
// loader anchors its toolchain lookup on; see configToolAnchors.
func resolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error) {
  return resolveBannerTextWithReporter(config, cwd, tsconfigPath, nil)
}

func resolveBannerTextWithReporter(config map[string]any, cwd, tsconfigPath string, reporter func(string)) (string, error) {
  return resolveBannerTextWithReporters(config, cwd, tsconfigPath, reporter, nil, nil)
}

func resolveBannerTextWithReporters(config map[string]any, cwd, tsconfigPath string, reporter func(string), hashReporter func(string, *string), realpathReporter func(string, *string)) (string, error) {
  if err := validateBannerConfig(config); err != nil {
    return "", err
  }
  resolutionRoot := tsconfigBaseDir(cwd, tsconfigPath)

  if rawConfigFile, ok := config["configFile"]; ok {
    configFile, ok := rawConfigFile.(string)
    if !ok || strings.TrimSpace(configFile) == "" {
      return "", fmt.Errorf("@ttsc/banner: \"configFile\" must be a non-empty string path")
    }
    location := resolveBannerConfigPath(configFile, cwd, tsconfigPath)
    loaded, err := loadBannerConfigFileWithInputs(location, resolutionRoot)
    if err != nil {
      return "", err
    }
    reportBannerConfigInputs(loaded.inputs, loaded.hashes, loaded.realpaths, reporter, hashReporter, realpathReporter)
    text, ok, err := bannerTextFromConfigValue(loaded.value, filepath.Base(location))
    if err != nil {
      return "", err
    }
    if !ok {
      return "", fmt.Errorf("@ttsc/banner: %s must export an object with a non-empty \"text\" string", location)
    }
    return text, nil
  }

  location, probed, err := findBannerConfigFile(cwd, tsconfigPath)
  // Report the rejected candidates before the error checks: a search that ended
  // ambiguous or empty examined them just the same, and a consumer that learns
  // of them can invalidate a generation the next search would answer
  // differently.
  driver.ReportRejectedConfigCandidates(probed, hashReporter, realpathReporter)
  if err != nil {
    return "", err
  }
  if location == "" {
    return "", fmt.Errorf("@ttsc/banner: no banner.config.{ts,cts,mts,js,cjs,mjs,json} file found; create one or set \"configFile\" in the tsconfig plugin entry")
  }
  loaded, err := loadBannerConfigFileWithInputs(location, resolutionRoot)
  if err != nil {
    return "", err
  }
  reportBannerConfigInputs(loaded.inputs, loaded.hashes, loaded.realpaths, reporter, hashReporter, realpathReporter)
  text, ok, err := bannerTextFromConfigValue(loaded.value, filepath.Base(location))
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

// bannerConfigFilenames is the discovery name list, in precedence order.
var bannerConfigFilenames = []string{
  "banner.config.json",
  "banner.config.js",
  "banner.config.cjs",
  "banner.config.mjs",
  "banner.config.ts",
  "banner.config.cts",
  "banner.config.mts",
}

// findBannerConfigFile walks up from the tsconfig (or cwd) directory looking for
// a banner.config.{ts,cts,mts,js,cjs,mjs,json} file. Returns the path when exactly
// one match is found per directory, "" when none exists at any level, or an
// error when multiple candidates exist in the same directory.
//
// The second return value is every candidate the walk examined and rejected,
// each carrying whether it was absent or a directory wearing the name. Those
// paths decide the result as much as the file it returned: one
// created nearer the entry wins the next search outright, and one created
// beside the match makes that directory ambiguous. The caller reports them so a
// persistent consumer stops serving output built from a config a cold run would
// no longer choose (samchon/ttsc#1271).
func findBannerConfigFile(cwd, tsconfigPath string) (string, []driver.ConfigCandidate, error) {
  discovery := driver.DiscoverConfigFile(tsconfigBaseDir(cwd, tsconfigPath), bannerConfigFilenames)
  if len(discovery.Matches) > 1 {
    names := make([]string, len(discovery.Matches))
    for i, match := range discovery.Matches {
      names[i] = filepath.Base(match)
    }
    return "", discovery.Probed, fmt.Errorf(
      "@ttsc/banner: multiple banner config files found in %s (%s); set \"configFile\" explicitly in the tsconfig plugin entry",
      discovery.Directory, strings.Join(names, ", "),
    )
  }
  if len(discovery.Matches) == 1 {
    return discovery.Matches[0], discovery.Probed, nil
  }
  return "", discovery.Probed, nil
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
//
// resolutionRoot is the project directory the TypeScript branch anchors its
// toolchain resolution on when the config file's own ancestry answers nothing;
// see configToolAnchors. The JSON and JS branches spawn no ttsx and ignore it.
func loadBannerConfigFile(location, resolutionRoot string) (any, error) {
  loaded, err := loadBannerConfigFileWithInputs(location, resolutionRoot)
  return loaded.value, err
}

type bannerLoadedConfig struct {
  hashes    map[string]*string
  inputs    []string
  realpaths map[string]*string
  value     any
}

func loadBannerConfigFileWithInputs(location, resolutionRoot string) (bannerLoadedConfig, error) {
  if !isBannerConfigFileName(filepath.Base(location)) {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: config file must be named banner.config.{ts,cts,mts,js,cjs,mjs,json}: %s", location)
  }
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    body, err := os.ReadFile(location)
    if err != nil {
      return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: read config file %s: %w", location, err)
    }
    value, err := parseBannerJSONConfigFile(location, body)
    digest := fmt.Sprintf("%x", sha256.Sum256(body))
    return bannerLoadedConfig{hashes: map[string]*string{location: &digest}, inputs: []string{location}, realpaths: map[string]*string{location: physicalHostInput(location)}, value: value}, err
  case ".js", ".cjs", ".mjs":
    return loadBannerScriptConfigFileWithInputs(location)
  }
  return loadBannerTypeScriptConfigFileWithInputs(location, resolutionRoot)
}

func reportBannerConfigInputs(inputs []string, hashes, realpaths map[string]*string, reporter func(string), hashReporter, realpathReporter func(string, *string)) {
  if reporter == nil && hashReporter == nil && realpathReporter == nil {
    return
  }
  for _, input := range inputs {
    if reporter != nil {
      reporter(input)
    }
    if hashReporter != nil {
      if hash, ok := hashes[input]; ok {
        hashReporter(input, hash)
      }
    }
    if realpathReporter != nil {
      if realpath, ok := realpaths[input]; ok {
        realpathReporter(input, realpath)
      }
    }
  }
}

func physicalHostInput(file string) *string {
  resolved, err := filepath.Abs(file)
  if err != nil {
    return nil
  }
  resolved = filepath.Clean(resolved)
  seen := make(map[string]struct{})
  for range 255 {
    if _, exists := seen[resolved]; exists {
      return nil
    }
    seen[resolved] = struct{}{}
    if evaluated, evalErr := filepath.EvalSymlinks(resolved); evalErr == nil {
      evaluated, evalErr = filepath.Abs(evaluated)
      if evalErr != nil {
        return nil
      }
      evaluated = filepath.Clean(evaluated)
      if _, statErr := os.Stat(evaluated); statErr != nil {
        return nil
      }
      return &evaluated
    }
    next, ok := resolveHostInputLinkAncestor(resolved)
    if !ok {
      return nil
    }
    resolved = next
  }
  return nil
}

// resolveHostInputLinkAncestor follows the nearest link-like ancestor and
// reattaches its remaining suffix. Windows junction children can be opened and
// os.Readlink exposes the junction itself even when EvalSymlinks rejects the
// complete child path.
func resolveHostInputLinkAncestor(location string) (string, bool) {
  probe := filepath.Clean(location)
  suffix := make([]string, 0)
  for {
    if target, err := os.Readlink(probe); err == nil {
      if !filepath.IsAbs(target) {
        target = filepath.Join(filepath.Dir(probe), target)
      }
      for i := len(suffix) - 1; i >= 0; i-- {
        target = filepath.Join(target, suffix[i])
      }
      absolute, absErr := filepath.Abs(target)
      if absErr != nil {
        return "", false
      }
      return filepath.Clean(absolute), true
    }
    parent := filepath.Dir(probe)
    if parent == probe {
      return "", false
    }
    suffix = append(suffix, filepath.Base(probe))
    probe = parent
  }
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
  return parseBannerJSONConfigFile(location, body)
}

func parseBannerJSONConfigFile(location string, body []byte) (any, error) {
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
  loaded, err := loadBannerScriptConfigFileWithInputs(location)
  return loaded.value, err
}

func loadBannerScriptConfigFileWithInputs(location string) (bannerLoadedConfig, error) {
  const script = `
const nodeModule = require("node:module");
const { createRequire, isBuiltin, registerHooks } = nodeModule;
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const inputs = new Set();
const hashes = new Map();
const realpaths = new Map();
const signatures = new Map();
const unstableHashes = new Set();

function existingFile(file) {
  try { return fs.statSync(file).isFile(); }
  catch { return false; }
}

function missingPathError(error) {
  return error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function inputMetadataSignature(file) {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try { target = fs.statSync(current, { bigint: true }); }
        catch { return undefined; }
      }
      return [path.relative(current, requested), link.dev, link.ino, link.mode, link.size, link.mtimeNs, link.ctimeNs, target.dev, target.ino, target.mode, target.size, target.mtimeNs, target.ctimeNs].join(":");
    } catch (error) {
      if (!missingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function recordInput(file) {
  file = path.resolve(file);
  inputs.add(file);
  if (unstableHashes.has(file)) return;
  const beforeSignature = inputMetadataSignature(file);
  let observed;
  let observedRealpath;
  try { observed = fs.statSync(file).isDirectory() ? crypto.createHash("sha256").update("ttsc:host-input:directory\\0").digest("hex") : crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
  catch { observed = null; }
  try { observedRealpath = fs.realpathSync.native(file); }
  catch { observedRealpath = null; }
  const afterSignature = inputMetadataSignature(file);
  if (beforeSignature === undefined || afterSignature === undefined || beforeSignature !== afterSignature || (signatures.has(file) && signatures.get(file) !== afterSignature) || (hashes.has(file) && hashes.get(file) !== observed) || (realpaths.has(file) && realpaths.get(file) !== observedRealpath)) {
    hashes.delete(file);
    realpaths.delete(file);
    signatures.delete(file);
    unstableHashes.add(file);
    return;
  }
  signatures.set(file, afterSignature);
  hashes.set(file, observed);
  realpaths.set(file, observedRealpath);
}

function recordFile(file) {
  const resolvedFile = path.resolve(file);
  recordInput(resolvedFile);
  for (let directory = path.dirname(resolvedFile);;) {
    const manifest = path.join(directory, "package.json");
    recordInput(manifest);
    if (existingFile(manifest)) {
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
}

function recordPackageManifests(file) {
  for (let directory = path.dirname(path.resolve(file));;) {
    const manifest = path.join(directory, "package.json");
    recordInput(manifest);
    if (existingFile(manifest)) return;
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

const moduleProbeExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json", ".node"];
function moduleCandidates(base) {
  return [
    base,
    ...moduleProbeExtensions.map((extension) => base + extension),
    path.join(base, "package.json"),
    ...moduleProbeExtensions.map((extension) => path.join(base, "index" + extension)),
  ];
}
const recordedModuleBases = new Set();
function recordManifestTargets(value, directory, allowBare = false) {
  if (typeof value === "string") {
    if (value !== "" && (allowBare || value.startsWith("./") || value.startsWith("../"))) recordModuleCandidates(path.resolve(directory, value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) recordManifestTargets(item, directory, allowBare);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) recordManifestTargets(item, directory, allowBare);
  }
}
function recordModuleCandidates(base) {
  const resolvedBase = path.resolve(base);
  if (recordedModuleBases.has(resolvedBase)) return;
  recordedModuleBases.add(resolvedBase);
  for (const candidate of moduleCandidates(resolvedBase)) recordInput(candidate);
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(resolvedBase, "package.json"), "utf8").replace(/^\uFEFF/, ""));
    recordManifestTargets(manifest.exports, resolvedBase);
    recordManifestTargets(manifest.module, resolvedBase, true);
    recordManifestTargets(manifest.main, resolvedBase, true);
  } catch {}
}
function candidateSelected(base, resolvedFile) {
  for (const candidate of moduleCandidates(base)) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const relative = path.relative(canonical, resolvedFile);
      if (relative === "" || (fs.statSync(canonical).isDirectory() && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))) return true;
    } catch {}
  }
  return false;
}
function localBases(specifier, parentDirectory) {
  if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];
  const raw = path.resolve(parentDirectory, specifier);
  const suffixStart = specifier.search(/[?#]/);
  if (suffixStart === -1) return [raw];
  const pathname = specifier.slice(0, suffixStart);
  return pathname === "" ? [raw] : [...new Set([raw, path.resolve(parentDirectory, pathname)])];
}
function recordResolutionCandidates(specifier, parentURL, resolvedURL) {
  if (typeof parentURL !== "string" || !parentURL.startsWith("file:")) return;
  const parentDirectory = path.dirname(fileURLToPath(parentURL));
  let resolvedFile;
  try {
    resolvedFile = typeof resolvedURL === "string" && resolvedURL.startsWith("file:")
      ? fs.realpathSync.native(fileURLToPath(resolvedURL))
      : undefined;
  } catch {}
  if (specifier.startsWith(".") || path.isAbsolute(specifier) || specifier.startsWith("file:")) {
    try {
      for (const base of localBases(specifier, parentDirectory)) {
        recordPackageManifests(base);
        let exact = false;
        try { exact = resolvedFile === undefined ? fs.statSync(base).isFile() : fs.realpathSync.native(base) === resolvedFile; } catch {}
        if (exact) recordInput(base);
        else recordModuleCandidates(base);
      }
    } catch {}
    return;
  }
  if (isBuiltin(specifier) || specifier.startsWith("#")) return;
  const parts = specifier.split("/");
  const packageParts = parts[0].startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) return;
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  const searchPaths = createRequire(parentURL).resolve.paths(specifier) ?? [];
  for (const searchPath of searchPaths) {
    const packageDirectory = path.join(searchPath, packageName);
    recordModuleCandidates(packageDirectory);
    if (subpath.length !== 0) recordModuleCandidates(path.join(packageDirectory, ...subpath));
    if (resolvedFile !== undefined && candidateSelected(packageDirectory, resolvedFile)) break;
  }
}

recordFile(process.argv[1]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    recordResolutionCandidates(specifier, context.parentURL, undefined);
    const resolved = nextResolve(specifier, context);
    const url = typeof resolved === "string" ? resolved : resolved && resolved.url;
    recordResolutionCandidates(specifier, context.parentURL, url);
    if (typeof url === "string" && url.startsWith("file:")) {
      recordFile(fileURLToPath(url));
    }
    return resolved;
  },
});

// The hook above never sees a require() made from inside a CommonJS module the
// ESM loader evaluated, which on Node 22 is every require the config makes:
// module.registerHooks observes the import() of that module and nothing within
// it. A config's own dependencies would then be reported without the candidates
// that decide them, so a spelling appearing later could change what the config
// resolves to with nothing in the envelope to notice it (samchon/ttsc#1280).
// Wrapping the CommonJS resolver records the same two observations the hook
// does, on the graph the hook cannot reach.
const nextResolveFilename = nodeModule._resolveFilename;
nodeModule._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  // _resolveFilename is an internal entry point anything may call, so a
  // non-string request arrives here as readily as a specifier does. Reading it
  // would replace Node's own argument error with a TypeError from this loader.
  if (typeof request !== "string") {
    return nextResolveFilename.call(this, request, parent, isMain, options);
  }
  const parentFile = parent && typeof parent.filename === "string" ? parent.filename : undefined;
  const parentURL = parentFile === undefined ? undefined : pathToFileURL(parentFile).href;
  recordResolutionCandidates(request, parentURL, undefined);
  const resolved = nextResolveFilename.call(this, request, parent, isMain, options);
  if (path.isAbsolute(resolved)) {
    recordResolutionCandidates(request, parentURL, pathToFileURL(resolved).href);
    recordFile(resolved);
  }
  return resolved;
};

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
  const serializedValue = toSerializableBanner(value);
  for (const input of [...inputs]) recordInput(input);
  process.stdout.write(JSON.stringify({ value: serializedValue, hashes: Object.fromEntries(hashes), inputs: [...inputs].sort(), realpaths: Object.fromEntries(realpaths) }));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
  process.stdout.write(JSON.stringify({ __ttscLoaderError: error && error.message ? String(error.message) : String(error) }), () => process.exit(1));
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
  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  // Windows limits the whole process command line to roughly 32 KiB. The
  // dependency-tracking loader is intentionally larger than that, so keep only
  // an explicit CommonJS stdin program and remove Node's stdin sentinel before
  // the loader runs. This preserves the historical process.argv layout seen by
  // both the loader and the imported user config without using string eval.
  cmd := exec.CommandContext(ctx, node, "--input-type=commonjs", "-", location)
  cmd.Stdin = strings.NewReader("process.argv.splice(1, 1);\n" + script)
  cmd.Env = nodeConfigLoaderEnv(location)
  // The child's stderr is human output and goes straight to this process's
  // stderr as it is written. Collecting it only to replay it afterwards is what
  // made a long evaluation print nothing at all, and what would make a loud one
  // grow this process's memory without bound.
  cmd.Stderr = os.Stderr
  output, err := cmd.Output()
  if err != nil {
    // The loader's stack already reached this process's stderr as it ran.
    // What it could not put there is a reason a caller can act on, so that
    // arrives through the payload channel instead.
    if reason := loaderFailureReason(output); reason != "" {
      return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: load config file %s: %s", location, reason)
    }
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: load config file %s: %w", location, err)
  }
  loaded, err := decodeBannerConfigLoaderOutput(output)
  if err != nil {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: parse config file %s output: %w", location, err)
  }
  return loaded, nil
}

func decodeBannerConfigLoaderOutput(output []byte) (bannerLoadedConfig, error) {
  var envelope struct {
    Error     string             `json:"__ttscLoaderError"`
    Hashes    map[string]*string `json:"hashes"`
    Inputs    []string           `json:"inputs"`
    Realpaths map[string]*string `json:"realpaths"`
    Value     json.RawMessage    `json:"value"`
  }
  if err := json.Unmarshal(output, &envelope); err != nil {
    return bannerLoadedConfig{}, err
  }
  if envelope.Error != "" {
    return bannerLoadedConfig{}, fmt.Errorf("%s", envelope.Error)
  }
  if len(envelope.Value) == 0 {
    // Test/fallback launchers written against the historical payload return
    // the config value directly. Preserve that accepted contract while real
    // loaders use the envelope to carry runtime inputs.
    var value any
    if err := json.Unmarshal(output, &value); err != nil {
      return bannerLoadedConfig{}, err
    }
    return bannerLoadedConfig{value: value}, nil
  }
  var value any
  if err := json.Unmarshal(envelope.Value, &value); err != nil {
    return bannerLoadedConfig{}, err
  }
  return bannerLoadedConfig{hashes: envelope.Hashes, inputs: envelope.Inputs, realpaths: envelope.Realpaths, value: value}, nil
}

// loadBannerTypeScriptConfigFile compiles and runs a TypeScript banner config
// file using ttsx in a temp directory. A symlink to the nearest node_modules
// is created so the config file can import its own dependencies. The ttsx
// build runs with `--no-plugins` so evaluating the config never triggers the
// host project's transform/check plugins against the loader tsconfig.
//
// Both tools this spawns — the launcher and the compiler handed to it — are
// resolved from the project rather than from the process environment alone;
// see configToolAnchors.
func loadBannerTypeScriptConfigFile(location, resolutionRoot string) (any, error) {
  loaded, err := loadBannerTypeScriptConfigFileWithInputs(location, resolutionRoot)
  return loaded.value, err
}

func loadBannerTypeScriptConfigFileWithInputs(location, resolutionRoot string) (bannerLoadedConfig, error) {
  tempDir, err := os.MkdirTemp(loaderTempBase(location, os.TempDir()), "ttsc-banner-config-")
  if err != nil {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: create config loader tempdir: %w", err)
  }
  defer os.RemoveAll(tempDir)

  if err := linkConfigNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return bannerLoadedConfig{}, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importSpecifier, err := relativeImportSpecifier(tempDir, location)
  if err != nil {
    return bannerLoadedConfig{}, err
  }
  importLiteral, _ := json.Marshal(importSpecifier)
  if err := writeConfigLoaderFile(loader, []byte(bannerTypeScriptConfigLoaderSource(string(importLiteral))), 0o644); err != nil {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: write config loader: %w", err)
  }
  if err := writeConfigLoaderFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: write config loader tsconfig: %w", err)
  }

  args := []string{
    "--project", tsconfig,
    "--cwd", tempDir,
    "--cache-dir", filepath.Join(tempDir, "cache"),
    "--no-plugins",
  }
  anchors := configToolAnchors(location, resolutionRoot)
  if tsgo := resolveConfigTsgo(anchors); tsgo != "" {
    args = append(args, "--binary", tsgo)
  }
  args = append(args, loader)

  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  cmd := ttsxCommandContext(ctx, anchors, args...)
  cmd.Env = nodeConfigLoaderEnv(location)
  // The child's stderr is human output and goes straight to this process's
  // stderr as it is written. Collecting it only to replay it afterwards is what
  // made a long evaluation print nothing at all, and what would make a loud one
  // grow this process's memory without bound.
  cmd.Stderr = os.Stderr
  output, err := cmd.Output()
  if err != nil {
    // The loader's stack already reached this process's stderr as it ran.
    // What it could not put there is a reason a caller can act on, so that
    // arrives through the payload channel instead.
    if reason := loaderFailureReason(output); reason != "" {
      return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %s", location, reason)
    }
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %w", location, err)
  }
  loaded, err := decodeBannerConfigLoaderOutput(output)
  if err != nil {
    return bannerLoadedConfig{}, fmt.Errorf("@ttsc/banner: parse TypeScript config file %s output: %w", location, err)
  }
  return loaded, nil
}

// bannerTypeScriptConfigLoaderSource returns the source of a TypeScript loader
// module that imports the banner config file specified by importLiteral (a
// JSON-encoded import specifier) and writes the serialized banner value to stdout.
func bannerTypeScriptConfigLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`// @ts-nocheck
import Module, { createRequire, isBuiltin, registerHooks } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const inputs = new Set<string>();
const hashes = new Map<string, string | null>();
const realpaths = new Map<string, string | null>();
const signatures = new Map<string, string>();
const unstableHashes = new Set<string>();

function existingFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); }
  catch { return false; }
}

function missingPathError(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function inputMetadataSignature(file: string): string | undefined {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try { target = fs.statSync(current, { bigint: true }); }
        catch { return undefined; }
      }
      return [path.relative(current, requested), link.dev, link.ino, link.mode, link.size, link.mtimeNs, link.ctimeNs, target.dev, target.ino, target.mode, target.size, target.mtimeNs, target.ctimeNs].join(":");
    } catch (error) {
      if (!missingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function recordInput(file: string): void {
  file = path.resolve(file);
  inputs.add(file);
  if (unstableHashes.has(file)) return;
  const beforeSignature = inputMetadataSignature(file);
  let observed: string | null;
  let observedRealpath: string | null;
  try { observed = fs.statSync(file).isDirectory() ? crypto.createHash("sha256").update("ttsc:host-input:directory\\0").digest("hex") : crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
  catch { observed = null; }
  try { observedRealpath = fs.realpathSync.native(file); }
  catch { observedRealpath = null; }
  const afterSignature = inputMetadataSignature(file);
  if (beforeSignature === undefined || afterSignature === undefined || beforeSignature !== afterSignature || (signatures.has(file) && signatures.get(file) !== afterSignature) || (hashes.has(file) && hashes.get(file) !== observed) || (realpaths.has(file) && realpaths.get(file) !== observedRealpath)) {
    hashes.delete(file);
    realpaths.delete(file);
    signatures.delete(file);
    unstableHashes.add(file);
    return;
  }
  signatures.set(file, afterSignature);
  hashes.set(file, observed);
  realpaths.set(file, observedRealpath);
}

function recordFile(file: string): void {
  const resolvedFile = path.resolve(file);
  recordInput(resolvedFile);
  for (let directory = path.dirname(resolvedFile);;) {
    const manifest = path.join(directory, "package.json");
    recordInput(manifest);
    if (existingFile(manifest)) {
      break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
}

function recordPackageManifests(file: string): void {
  for (let directory = path.dirname(path.resolve(file));;) {
    const manifest = path.join(directory, "package.json");
    recordInput(manifest);
    if (existingFile(manifest)) return;
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

const moduleProbeExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json", ".node"] as const;
const jsToTsProbeExtensions = new Map<string, readonly string[]>([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);
function sourceSubstitutionCandidates(base: string): string[] {
  const extension = path.extname(base).toLowerCase();
  const substitutions = jsToTsProbeExtensions.get(extension);
  if (substitutions === undefined) return [];
  const stem = base.slice(0, base.length - extension.length);
  return substitutions.map((candidate) => stem + candidate);
}
function moduleCandidates(base: string): string[] {
  return [
    base,
    ...sourceSubstitutionCandidates(base),
    ...moduleProbeExtensions.map((extension) => base + extension),
    path.join(base, "package.json"),
    ...moduleProbeExtensions.map((extension) => path.join(base, "index" + extension)),
  ];
}
const recordedModuleBases = new Set<string>();
function recordManifestTargets(value: unknown, directory: string, allowBare: boolean = false): void {
  if (typeof value === "string") {
    if (value !== "" && (allowBare || value.startsWith("./") || value.startsWith("../"))) recordModuleCandidates(path.resolve(directory, value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) recordManifestTargets(item, directory, allowBare);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) recordManifestTargets(item, directory, allowBare);
  }
}
function recordModuleCandidates(base: string): void {
  const resolvedBase = path.resolve(base);
  if (recordedModuleBases.has(resolvedBase)) return;
  recordedModuleBases.add(resolvedBase);
  for (const candidate of moduleCandidates(resolvedBase)) recordInput(candidate);
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(resolvedBase, "package.json"), "utf8").replace(/^\uFEFF/, ""));
    recordManifestTargets(manifest.exports, resolvedBase);
    recordManifestTargets(manifest.module, resolvedBase, true);
    recordManifestTargets(manifest.main, resolvedBase, true);
  } catch {}
}
function candidateSelected(base: string, resolvedFile: string): boolean {
  for (const candidate of moduleCandidates(base)) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const relative = path.relative(canonical, resolvedFile);
      if (relative === "" || (fs.statSync(canonical).isDirectory() && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))) return true;
    } catch {}
  }
  return false;
}
function localBases(specifier: string, parentDirectory: string): string[] {
  if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];
  const raw = path.resolve(parentDirectory, specifier);
  const suffixStart = specifier.search(/[?#]/);
  if (suffixStart === -1) return [raw];
  const pathname = specifier.slice(0, suffixStart);
  return pathname === "" ? [raw] : [...new Set([raw, path.resolve(parentDirectory, pathname)])];
}
function recordResolutionCandidates(specifier: string, parentURL: string | undefined, resolvedURL: string | undefined): void {
  if (typeof parentURL !== "string" || !parentURL.startsWith("file:")) return;
  const parentDirectory = path.dirname(fileURLToPath(parentURL));
  let resolvedFile: string | undefined;
  try {
    resolvedFile = typeof resolvedURL === "string" && resolvedURL.startsWith("file:")
      ? fs.realpathSync.native(fileURLToPath(resolvedURL))
      : undefined;
  } catch {}
  if (specifier.startsWith(".") || path.isAbsolute(specifier) || specifier.startsWith("file:")) {
    try {
      for (const base of localBases(specifier, parentDirectory)) {
        recordPackageManifests(base);
        let exact = false;
        try { exact = resolvedFile === undefined ? fs.statSync(base).isFile() : fs.realpathSync.native(base) === resolvedFile; } catch {}
        if (exact) recordInput(base);
        else recordModuleCandidates(base);
      }
    } catch {}
    return;
  }
  if (isBuiltin(specifier) || specifier.startsWith("#")) return;
  const parts = specifier.split("/");
  const packageParts = parts[0]!.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) return;
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  const searchPaths = createRequire(parentURL).resolve.paths(specifier) ?? [];
  for (const searchPath of searchPaths) {
    const packageDirectory = path.join(searchPath, packageName);
    recordModuleCandidates(packageDirectory);
    if (subpath.length !== 0) recordModuleCandidates(path.join(packageDirectory, ...subpath));
    if (resolvedFile !== undefined && candidateSelected(packageDirectory, resolvedFile)) break;
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    recordResolutionCandidates(specifier, context.parentURL, undefined);
    const resolved = nextResolve(specifier, context);
    const url = typeof resolved === "string" ? resolved : resolved?.url;
    recordResolutionCandidates(specifier, context.parentURL, url);
    if (typeof url === "string" && url.startsWith("file:")) {
      recordFile(fileURLToPath(url));
    }
    return resolved;
  },
});

// The hook above never sees a require() made from inside a CommonJS module the
// ESM loader evaluated, which on Node 22 is every require the config makes:
// module.registerHooks observes the import() of that module and nothing within
// it. A config's own dependencies would then be reported without the candidates
// that decide them, so a spelling appearing later could change what the config
// resolves to with nothing in the envelope to notice it (samchon/ttsc#1280).
// Wrapping the CommonJS resolver records the same two observations the hook
// does, on the graph the hook cannot reach.
const moduleInternals = Module as unknown as {
  _resolveFilename(
    request: string,
    parent: { filename?: string | null } | null | undefined,
    isMain: boolean,
    options?: unknown,
  ): string;
};
const nextResolveFilename = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function resolveFilename(
  this: unknown,
  request: string,
  parent: { filename?: string | null } | null | undefined,
  isMain: boolean,
  options?: unknown,
): string {
  // _resolveFilename is an internal entry point anything may call, so a
  // non-string request arrives here as readily as a specifier does. Reading it
  // would replace Node's own argument error with a TypeError from this loader.
  if (typeof request !== "string") {
    return nextResolveFilename.call(this, request, parent, isMain, options);
  }
  const parentURL =
    typeof parent?.filename === "string"
      ? pathToFileURL(parent.filename).href
      : undefined;
  recordResolutionCandidates(request, parentURL, undefined);
  const resolved = nextResolveFilename.call(this, request, parent, isMain, options);
  if (path.isAbsolute(resolved)) {
    recordResolutionCandidates(request, parentURL, pathToFileURL(resolved).href);
    recordFile(resolved);
  }
  return resolved;
};

declare const process: {
  exitCode?: number;
  stdout: { write(value: string, callback?: () => void): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

// Wrapped rather than written as a top-level await: the loader tsconfig's
// "module" follows the config's own package, and TS1378 rejects top-level await
// under a CommonJS module option however this .mts file emits. The body's own
// catch is the only failure path — it ends the process — so there is nothing
// left for a trailing handler to settle.
(async () => {
  try {
    const importedConfig = await import(%s);
    const value = await resolveConfig(importedConfig);
    const serializedValue = toSerializableBanner(value);
    for (const input of [...inputs]) recordInput(input);
    process.stdout.write(JSON.stringify({
      value: serializedValue,
      hashes: Object.fromEntries(hashes),
      inputs: [...inputs].sort(),
      realpaths: Object.fromEntries(realpaths),
    }));
  } catch (error) {
    process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
    // The stack above is for the reader. This is for the caller: the parent
    // reads stdout as the payload channel either way, so a failure reason
    // travels as data rather than as text scraped back out of a captured
    // stream. The exit code is set before the write so a callback that never
    // fires still fails the load, and the write's completion is what triggers
    // the exit, because process.exit abandons a pending pipe write.
    process.exitCode = 1;
    process.stdout.write(
      JSON.stringify({ __ttscLoaderError: error instanceof Error ? error.message : String(error) }),
      () => process.exit(1),
    );
  }
})();

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
      "allowImportingTsExtensions": true,
      // The config is a Node module, so Node's rule decides its format: the
      // nearest package.json "type" above it. Hardcoding one answer ran every
      // ambiguous `.ts` config as ESM and broke __dirname in an ordinary
      // CommonJS package (#1069). moduleResolution stays "bundler", which tsgo
      // accepts for both kinds, so extensionless relative imports keep
      // resolving either way.
      "module":                          configModuleOption(location),
      "moduleResolution":                "bundler",
      "jsx":                             "preserve",
      "outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
      "rewriteRelativeImportExtensions": true,
      "rootDir":                         loaderRootDir(outDir),
      "skipLibCheck":                    true,
      "strict":                          true,
      "target":                          "ES2022",
      // TypeScript 7 includes no ambient type package unless "types" asks for
      // it, and this Program extends nothing, so without the wildcard a config
      // could not name a single Node global (#1069). The loader directory links
      // the config's nearest node_modules, so the default typeRoots walk finds
      // exactly what the project installed.
      "types": []string{"*"},
    },
    "files": []string{
      filepath.ToSlash(loader),
      filepath.ToSlash(location),
    },
  }
  body, _ := json.MarshalIndent(content, "", "  ")
  return string(body)
}

// ttsc:config-loader-shared begin
//
// One policy in three Go copies: everything between these markers is
// duplicated verbatim in packages/lint/linthost/config.go,
// packages/banner/driver/banner.go and packages/strip/driver/config.go. #1169
// decided against extracting it — the only home the three modules could share
// is the public `packages/ttsc/driver` seam, and packages/lint's go.mod
// deliberately requires no in-tree ttsc module — and replaced the checklist
// with a gate: `scripts/ci/config-loader-copies.cjs` compares every function
// between these markers across all three copies on every pull request, so
// editing one and not the others fails by name. That file's header carries the
// full decision and the rules for changing this block.
//
// The code between the markers must stay identical. Comments may differ, the
// `@ttsc/<pkg>:` error prefix may differ, and @ttsc/strip spells each name with
// a `strip` prefix. Anything package-specific belongs outside the markers.

// configModuleOption returns the loader tsconfig's "module" for a config file:
// the module kind Node itself would give that file.
//
// An explicit .cts/.cjs or .mts/.mjs extension already decides the emit format
// on its own, so those keep the ES-module setting and let the extension win —
// the same precedence tsgo applies. Everything ambiguous walks up for the
// nearest package.json "type", exactly as Node does when it loads the file.
func configModuleOption(location string) string {
  switch strings.ToLower(filepath.Ext(location)) {
  case ".ts", ".tsx", ".js":
    if nearestPackageType(location) == "commonjs" {
      return "CommonJS"
    }
  }
  return "ESNext"
}

// nearestPackageType mirrors Node's package-scope lookup for the nearest
// package.json above location: the walk stops at the FIRST manifest it finds,
// and a manifest declaring no "type" means CommonJS rather than a reason to
// keep climbing. Reaching the filesystem root without any manifest also means
// CommonJS. The location is made absolute first, so a relative config path
// cannot end the walk at "." after a single step.
func nearestPackageType(location string) string {
  absolute, err := filepath.Abs(location)
  if err != nil {
    absolute = location
  }
  dir := filepath.Dir(absolute)
  for {
    raw, err := os.ReadFile(filepath.Join(dir, "package.json"))
    if err == nil {
      var manifest struct {
        Type string `json:"type"`
      }
      // A manifest that does not parse still bounds the package scope; Node
      // refuses to look past it, and CommonJS is the format it defaults to.
      if json.Unmarshal(raw, &manifest) == nil && manifest.Type == "module" {
        return "module"
      }
      return "commonjs"
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return "commonjs"
    }
    dir = parent
  }
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

// realpathIfPossible resolves location through its symlinks, and returns it
// unchanged when it cannot be evaluated (a path that does not exist, or an
// NTFS junction filepath.EvalSymlinks refuses to traverse).
func realpathIfPossible(location string) string {
  real, err := filepath.EvalSymlinks(location)
  if err != nil {
    return location
  }
  return real
}

// Both tools the TypeScript config evaluator needs — the `ttsx` launcher it
// spawns and the native compiler it hands that launcher — are resolved from
// the project being compiled, with an explicit environment variable winning
// and a last resort that invents no path.
//
// The three Go copies are held identical by the gate named at the top of this
// block. The JS original — `resolveConfigTsgo` / `resolveTtsxLauncher` in
// packages/lint/src/index.ts — is a fourth copy in another language that no Go
// gate can reach; what it owes is that both policies stay describable in one
// sentence.
//
// The environment alone is the wrong place to ask. `ttsx` exports
// TTSC_TSGO_BINARY and TTSC_TTSX_BINARY to its own descendants, so a host
// launched under `ttsx` inherited both and a host launched any other way
// inherited neither. The shipped `ttscserver` binary invoked with its
// documented `--tsgo <path>` flag keeps that path in a local and exports
// nothing, and an embedder of the driver package exports nothing either. For
// those the evaluator spawned a bare `ttsx` that only a global install puts on
// PATH, and, past that, a compiler-less child that aborted with
// `ttsc: typescript is required` before a line of the config was read.
//
// configToolAnchors lists the file paths those resolutions walk upward from,
// in order: the config file being evaluated, then the resolution root's
// manifest. The config comes first because it is the file whose own
// installation decides which toolchain the config's imports were written
// against; the resolution root answers for a config that lives outside the
// project tree (a `configFile` pointed at a shared package), and for one
// discovered above a workspace that installs its own toolchain.
func configToolAnchors(configPath, resolutionRoot string) []string {
  anchors := make([]string, 0, 2)
  if strings.TrimSpace(configPath) != "" {
    anchors = append(anchors, configPath)
  }
  if strings.TrimSpace(resolutionRoot) != "" {
    anchors = append(anchors, filepath.Join(resolutionRoot, "package.json"))
  }
  return anchors
}

// resolveConfigTsgo returns the native TypeScript compiler the evaluator hands
// its ttsx child through `--binary`, or "" to leave the child resolving for
// itself.
//
// The child runs with `--cwd <ephemeral loader dir>`, so it cannot discover
// `typescript` the way an ordinary invocation does: linkNearestNodeModules is
// the only thing that puts the project's modules within its reach, and it links
// nothing when the config's ancestry carries no node_modules. An explicit
// TTSC_TSGO_BINARY still wins, so an embedder that pins a compiler keeps
// pinning it. "" is the unchanged last resort: a project that cannot answer
// here could not answer inside the child either, and the child's own diagnostic
// is the one that names the missing package.
func resolveConfigTsgo(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TSGO_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if binary := tsgoBinaryFrom(anchor); binary != "" {
      return binary
    }
  }
  return ""
}

// tsgoBinaryFrom returns the platform compiler executable of the `typescript`
// install `anchor` can see, or "" when this anchor reaches neither the package
// nor its platform dependency.
//
// Mirrors resolveTsgo.ts so the Go plugin and the JS launcher name one file:
// the `typescript` manifest, then `@typescript/typescript-<platform>-<arch>`
// resolved from that manifest, then `lib/tsc` inside it.
//
// The install is chased to its real directory before the second hop, because
// Node resolves a module's own dependencies from its real location. pnpm keeps
// the real `typescript` directory in its content-addressed store with the
// platform package beside it and leaves a link in the project's node_modules,
// so a walk that started at the link would climb straight past the platform
// package. NTFS junctions defeat filepath.EvalSymlinks, so the link component
// is chased by hand first, the same order loaderTempBase uses.
func tsgoBinaryFrom(anchor string) string {
  manifest := nodePackageManifestFrom(anchor, "typescript")
  if manifest == "" {
    return ""
  }
  packageDir := realpathIfPossible(resolveDirLink(filepath.Dir(manifest)))
  platform, arch := nodePlatformPair()
  platformManifest := nodePackageManifestFrom(
    filepath.Join(packageDir, "package.json"),
    "@typescript/typescript-"+platform+"-"+arch,
  )
  if platformManifest == "" {
    return ""
  }
  name := "tsc"
  if runtime.GOOS == "windows" {
    name = "tsc.exe"
  }
  binary := filepath.Join(filepath.Dir(platformManifest), "lib", name)
  if stat, err := os.Stat(binary); err != nil || stat.IsDir() {
    return ""
  }
  return binary
}

// resolveTtsxLauncher returns the launcher ttsxCommandContext spawns.
//
// An explicit TTSC_TTSX_BINARY wins. Otherwise the launcher is derived from the
// `ttsc` installation one of the anchors can see, because a bare command name
// only works when a bin link happens to be on PATH — which it is for a global
// install and is not for the ordinary project-local one. The bare `"ttsx"` name
// remains the unchanged last resort for an installation no anchor reaches.
func resolveTtsxLauncher(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TTSX_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if launcher := ttsxLauncherFrom(anchor); launcher != "" {
      return launcher
    }
  }
  return "ttsx"
}

// ttsxLauncherFrom returns `lib/launcher/ttsx.js` of the `ttsc` install
// `anchor` can see, or "" when this anchor reaches no such install. Only the
// manifest is an exported subpath, so the launcher is derived from where the
// manifest resolved rather than requested as a subpath of its own.
func ttsxLauncherFrom(anchor string) string {
  manifest := nodePackageManifestFrom(anchor, "ttsc")
  if manifest == "" {
    return ""
  }
  launcher := filepath.Join(filepath.Dir(manifest), "lib", "launcher", "ttsx.js")
  if stat, err := os.Stat(launcher); err != nil || stat.IsDir() {
    return ""
  }
  return launcher
}

// nodePackageManifestFrom resolves `<pkg>/package.json` the way Node's
// require.resolve does from the FILE `anchor`: walk upward from the anchor's
// directory and return the first `<dir>/node_modules/<pkg>/package.json` that
// exists. The anchor is treated as a file path, so its own directory is the
// first candidate's parent, and it need not exist — Node derives the search
// paths from the string alone.
//
// A directory already named `node_modules` contributes no candidate of its own,
// matching Module._nodeModulePaths, so nothing ever resolves through
// `node_modules/node_modules`.
//
// A relative anchor is resolved against the process directory before the walk,
// again matching Node. Walking a relative path instead would terminate at "."
// after one step and silently answer nothing for a config named relatively.
func nodePackageManifestFrom(anchor, pkg string) string {
  if strings.TrimSpace(anchor) == "" || pkg == "" {
    return ""
  }
  if absolute, err := filepath.Abs(anchor); err == nil {
    anchor = absolute
  }
  dir := filepath.Dir(filepath.Clean(anchor))
  for {
    if filepath.Base(dir) != "node_modules" {
      candidate := filepath.Join(dir, "node_modules", filepath.FromSlash(pkg), "package.json")
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        return candidate
      }
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

// nodePlatformPair is nodePlatformPairFor applied to this build's own target.
func nodePlatformPair() (string, string) {
  return nodePlatformPairFor(runtime.GOOS, runtime.GOARCH)
}

// nodePlatformPairFor maps a Go build target onto the `process.platform` and
// `process.arch` pair npm spells a platform package with, so the package name
// this plugin resolves is the same one the JS launcher resolves.
//
// Only the members whose two vocabularies disagree are mapped. Every other
// value is identical on both sides and passes through, which keeps a target
// neither side publishes yet resolvable rather than silently wrong, and keeps
// this from becoming a list that has to grow with every new port.
func nodePlatformPairFor(goos, goarch string) (string, string) {
  platform := goos
  switch platform {
  case "windows":
    platform = "win32"
  case "solaris":
    platform = "sunos"
  }
  arch := goarch
  switch arch {
  case "amd64":
    arch = "x64"
  case "386":
    arch = "ia32"
  case "ppc64le":
    arch = "ppc64"
  }
  return platform, arch
}

// ttsxCommand builds an exec.Cmd that runs ttsx with the given args.
// When the resolved launcher has a script extension (.js, .ts, …) the binary is
// invoked via the Node runtime so it is executed correctly on all platforms.
func ttsxCommand(anchors []string, args ...string) *exec.Cmd {
  return ttsxCommandContext(context.Background(), anchors, args...)
}

// ttsxCommandContext is the context-bound variant used by config loaders. It
// carries no deadline: evaluating a user config is the user's own code running,
// and how long that is allowed to take is not this binary's decision.
//
// `anchors` are the file paths the launcher is resolved from; see
// resolveTtsxLauncher.
func ttsxCommandContext(ctx context.Context, anchors []string, args ...string) *exec.Cmd {
  ttsx := resolveTtsxLauncher(anchors)
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
  return windowsjunction.Create(link, target)
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

// loaderFailureReason reads the failure envelope a config loader writes to its
// payload channel when it stops on an error it can name.
//
// The loader's stack goes to this process's stderr as it runs, which is where a
// reader wants it. But the *reason* — "config file must export an object with a
// non-empty text string" — is a fact about the user's config, and a caller
// deserves it in the error rather than having to go find it in the log. So it
// travels as data through the same stdout the payload uses, and only a
// well-formed envelope is honoured: anything else leaves the process status to
// speak for itself.
func loaderFailureReason(output []byte) string {
  var envelope struct {
    Message string `json:"__ttscLoaderError"`
  }
  if json.Unmarshal(output, &envelope) != nil {
    return ""
  }
  return strings.TrimSpace(envelope.Message)
}

// ttsc:config-loader-shared end
