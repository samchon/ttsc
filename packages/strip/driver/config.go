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

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

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

  // The discovery base directory doubles as the resolution root the config
  // loader anchors its toolchain lookup on; see stripConfigToolAnchors.
  resolutionRoot := stripDiscoveryBaseDir(cwd, tsconfigPath)

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

  raw, err := loadStripConfigFile(configFilePath, resolutionRoot)
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
// upward. The launcher's explicit project-root channel
// (driver.PluginConfigDirEnv) wins when set — the tsconfig may be a generated
// wrapper in a temp directory that no longer identifies the project —
// otherwise the tsconfig directory is preferred over cwd so nested package
// configs are found relative to the tsconfig that triggered the strip run.
func stripDiscoveryBaseDir(cwd, tsconfigPath string) string {
  return driver.PluginConfigBaseDir(cwd, tsconfigPath)
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
//
// resolutionRoot is the project directory the TypeScript branch anchors its
// toolchain resolution on when the config file's own ancestry answers nothing;
// see stripConfigToolAnchors. The JSON and JS branches spawn no ttsx and
// ignore it.
func loadStripConfigFile(location, resolutionRoot string) (any, error) {
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".json":
    return loadStripJSONConfigFile(location)
  case ".js", ".cjs", ".mjs":
    return loadStripScriptConfigFile(location)
  case ".ts", ".cts", ".mts":
    return loadStripTypeScriptConfigFile(location, resolutionRoot)
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
  // The stack above is for the reader. This is for the caller: the parent reads
  // stdout as the payload channel either way, so a failure reason travels as
  // data rather than as text scraped back out of a captured stream. The exit
  // code is set before the write so a callback that never fires still fails the
  // load, and the write's completion is what triggers the exit, because
  // process.exit abandons a pending pipe write.
  process.exitCode = 1;
  process.stdout.write(JSON.stringify({ __ttscLoaderError: error && error.message ? String(error.message) : String(error) }), () => process.exit(1));
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
  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  cmd := exec.CommandContext(ctx, node, "-e", stripScriptLoaderSource, location)
  cmd.Env = stripNodeConfigLoaderEnv(location)
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
      return nil, fmt.Errorf("@ttsc/strip: load config file %s: %s", location, reason)
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
`, importLiteral)
}

// loadStripTypeScriptConfigFile evaluates a .ts/.cts/.mts config file by writing
// an ephemeral loader script and tsconfig into a temp directory, symlinking the
// nearest node_modules, then running ttsx.
//
// The ttsx build runs with `--no-plugins`: the loader only needs to
// type-check and execute the strip config file, so loading the host
// project's transform/check plugins would be wasteful and could fail the
// build against this deliberately lenient loader tsconfig.
//
// Both tools this spawns — the launcher and the compiler handed to it — are
// resolved from the project rather than from the process environment alone;
// see stripConfigToolAnchors.
func loadStripTypeScriptConfigFile(location, resolutionRoot string) (any, error) {
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
  anchors := stripConfigToolAnchors(location, resolutionRoot)
  if tsgo := stripResolveConfigTsgo(anchors); tsgo != "" {
    args = append(args, "--binary", tsgo)
  }
  args = append(args, loader)

  ctx, cancel := context.WithCancel(context.Background())
  defer cancel()
  cmd := stripTtsxCommandContext(ctx, anchors, args...)
  cmd.Env = stripNodeConfigLoaderEnv(location)
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
      return nil, fmt.Errorf("@ttsc/strip: load TypeScript config file %s: %s", location, reason)
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
      "allowImportingTsExtensions": true,
      "allowJs":                    true,
      "checkJs":                    false,
      // The config is a Node module, so Node's rule decides its format: the
      // nearest package.json "type" above it. Hardcoding one answer ran every
      // ambiguous `.ts` config as ESM and broke __dirname in an ordinary
      // CommonJS package (#1069). moduleResolution stays "bundler", which tsgo
      // accepts for both kinds, so extensionless relative imports keep
      // resolving either way.
      "module":                          stripConfigModuleOption(location),
      "moduleResolution":                "bundler",
      "noImplicitAny":                   false,
      "outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
      "rewriteRelativeImportExtensions": true,
      "rootDir":                         stripLoaderRootDir(outDir),
      "skipLibCheck":                    true,
      "strict":                          false,
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
  body, err := json.MarshalIndent(content, "", "  ")
  if err != nil {
    panic(err)
  }
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

// stripConfigModuleOption returns the loader tsconfig's "module" for a config
// file: the module kind Node itself would give that file.
//
// An explicit .cts/.cjs or .mts/.mjs extension already decides the emit format
// on its own, so those keep the ES-module setting and let the extension win —
// the same precedence tsgo applies. Everything ambiguous walks up for the
// nearest package.json "type", exactly as Node does when it loads the file.
func stripConfigModuleOption(location string) string {
  switch strings.ToLower(filepath.Ext(location)) {
  case ".ts", ".tsx", ".js":
    if stripNearestPackageType(location) == "commonjs" {
      return "CommonJS"
    }
  }
  return "ESNext"
}

// stripNearestPackageType mirrors Node's package-scope lookup for the nearest
// package.json above location: the walk stops at the FIRST manifest it finds,
// and a manifest declaring no "type" means CommonJS rather than a reason to
// keep climbing. Reaching the filesystem root without any manifest also means
// CommonJS. The location is made absolute first, so a relative config path
// cannot end the walk at "." after a single step.
func stripNearestPackageType(location string) string {
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

// stripRealpathIfPossible resolves location through its symlinks, and returns
// it unchanged when it cannot be evaluated (a path that does not exist, or an
// NTFS junction filepath.EvalSymlinks refuses to traverse).
func stripRealpathIfPossible(location string) string {
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
// stripConfigToolAnchors lists the file paths those resolutions walk upward
// from, in order: the config file being evaluated, then the resolution root's
// manifest. The config comes first because it is the file whose own
// installation decides which toolchain the config's imports were written
// against; the resolution root answers for a config that lives outside the
// project tree (a `configFile` pointed at a shared package), and for one
// discovered above a workspace that installs its own toolchain.
func stripConfigToolAnchors(configPath, resolutionRoot string) []string {
  anchors := make([]string, 0, 2)
  if strings.TrimSpace(configPath) != "" {
    anchors = append(anchors, configPath)
  }
  if strings.TrimSpace(resolutionRoot) != "" {
    anchors = append(anchors, filepath.Join(resolutionRoot, "package.json"))
  }
  return anchors
}

// stripResolveConfigTsgo returns the native TypeScript compiler the evaluator
// hands its ttsx child through `--binary`, or "" to leave the child resolving
// for itself.
//
// The child runs with `--cwd <ephemeral loader dir>`, so it cannot discover
// `typescript` the way an ordinary invocation does: stripLinkNearestNodeModules
// is the only thing that puts the project's modules within its reach, and it
// links nothing when the config's ancestry carries no node_modules. An explicit
// TTSC_TSGO_BINARY still wins, so an embedder that pins a compiler keeps
// pinning it. "" is the unchanged last resort: a project that cannot answer
// here could not answer inside the child either, and the child's own diagnostic
// is the one that names the missing package.
func stripResolveConfigTsgo(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TSGO_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if binary := stripTsgoBinaryFrom(anchor); binary != "" {
      return binary
    }
  }
  return ""
}

// stripTsgoBinaryFrom returns the platform compiler executable of the
// `typescript` install `anchor` can see, or "" when this anchor reaches neither
// the package nor its platform dependency.
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
// is chased by hand first, the same order stripLoaderTempBase uses.
func stripTsgoBinaryFrom(anchor string) string {
  manifest := stripNodePackageManifestFrom(anchor, "typescript")
  if manifest == "" {
    return ""
  }
  packageDir := stripRealpathIfPossible(stripResolveDirLink(filepath.Dir(manifest)))
  platform, arch := stripNodePlatformPair()
  platformManifest := stripNodePackageManifestFrom(
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

// stripResolveTtsxLauncher returns the launcher stripTtsxCommandContext spawns.
//
// An explicit TTSC_TTSX_BINARY wins. Otherwise the launcher is derived from the
// `ttsc` installation one of the anchors can see, because a bare command name
// only works when a bin link happens to be on PATH — which it is for a global
// install and is not for the ordinary project-local one. The bare `"ttsx"` name
// remains the unchanged last resort for an installation no anchor reaches.
func stripResolveTtsxLauncher(anchors []string) string {
  if explicit := strings.TrimSpace(os.Getenv("TTSC_TTSX_BINARY")); explicit != "" {
    return explicit
  }
  for _, anchor := range anchors {
    if launcher := stripTtsxLauncherFrom(anchor); launcher != "" {
      return launcher
    }
  }
  return "ttsx"
}

// stripTtsxLauncherFrom returns `lib/launcher/ttsx.js` of the `ttsc` install
// `anchor` can see, or "" when this anchor reaches no such install. Only the
// manifest is an exported subpath, so the launcher is derived from where the
// manifest resolved rather than requested as a subpath of its own.
func stripTtsxLauncherFrom(anchor string) string {
  manifest := stripNodePackageManifestFrom(anchor, "ttsc")
  if manifest == "" {
    return ""
  }
  launcher := filepath.Join(filepath.Dir(manifest), "lib", "launcher", "ttsx.js")
  if stat, err := os.Stat(launcher); err != nil || stat.IsDir() {
    return ""
  }
  return launcher
}

// stripNodePackageManifestFrom resolves `<pkg>/package.json` the way Node's
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
func stripNodePackageManifestFrom(anchor, pkg string) string {
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

// stripNodePlatformPair is stripNodePlatformPairFor applied to this build's own
// target.
func stripNodePlatformPair() (string, string) {
  return stripNodePlatformPairFor(runtime.GOOS, runtime.GOARCH)
}

// stripNodePlatformPairFor maps a Go build target onto the `process.platform`
// and `process.arch` pair npm spells a platform package with, so the package
// name this plugin resolves is the same one the JS launcher resolves.
//
// Only the members whose two vocabularies disagree are mapped. Every other
// value is identical on both sides and passes through, which keeps a target
// neither side publishes yet resolvable rather than silently wrong, and keeps
// this from becoming a list that has to grow with every new port.
func stripNodePlatformPairFor(goos, goarch string) (string, string) {
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

// stripTtsxCommandContext returns an exec.Cmd that runs ttsx with the given
// arguments, routing through node when the resolved binary is a script file.
//
// `anchors` are the file paths the launcher is resolved from; see
// stripResolveTtsxLauncher.
func stripTtsxCommandContext(ctx context.Context, anchors []string, args ...string) *exec.Cmd {
  ttsx := stripResolveTtsxLauncher(anchors)
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
  return windowsjunction.Create(link, target)
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
