import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { TestProject } from "../TestProject";

/**
 * Fixture builder for unplugin adapter and transform tests.
 *
 * The generated project contains a TypeScript entrypoint, a tsconfig plugin
 * descriptor, and a tiny Go source transformer. That lets tests exercise the
 * same native source-plugin path that real bundler integrations use.
 */
export namespace TestUnpluginProject {
  /**
   * Options for the synthetic project used by unplugin transform scenarios.
   *
   * `plugins` overrides the default single-plugin descriptor so individual
   * tests can vary plugin ordering, config fields, or the absence of plugins.
   * `source` overrides the TypeScript entrypoint written to `src/main.ts`.
   */
  interface ICreateProjectOptions {
    plugins?: unknown[];
    source?: string;
  }

  /** Require function scoped to the unplugin package under test. */
  export const REQUIRE_FROM_UNPLUGIN = createRequire(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "unplugin",
      "package.json",
    ),
  );

  // transformTtsc() runs in-process, so seed the same tsgo override that the
  // spawn-based helpers pass explicitly through child-process environments.
  process.env.TTSC_TSGO_BINARY ??= resolveTsgoBinary();
  let sharedCacheDir: string | undefined;

  /**
   * Create a temporary project that transforms `goUpper("...")` through a Go
   * plugin descriptor. Callers can override plugin config or source text to
   * probe adapter-specific behavior without duplicating fixture setup.
   */
  export function createProject(options: ICreateProjectOptions = {}) {
    ensureSharedCacheDir();
    const root = TestProject.tmpdir("ttsc-unplugin-");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      mainFile(root),
      options.source ??
        'export const value: string = goUpper("plugin");\nconsole.log(value);\n',
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, type: "commonjs" }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            rootDir: "src",
            outDir: "dist",
            plugins:
              options.plugins === undefined
                ? [{ transform: "./plugin.cjs", name: "fixture" }]
                : options.plugins,
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "utf8",
    );
    writePluginEntry(root);
    writeGoPlugin(root);
    return root;
  }

  /**
   * Set `TTSC_CACHE_DIR` once for the process lifetime so Go plugin builds are
   * shared across test cases. Skipped when the caller has already set the env
   * var (e.g. from a parent test runner that manages its own cache dir).
   */
  function ensureSharedCacheDir(): void {
    if (process.env.TTSC_CACHE_DIR !== undefined) {
      return;
    }
    sharedCacheDir ??= TestProject.tmpdir("ttsc-unplugin-cache-");
    process.env.TTSC_CACHE_DIR = sharedCacheDir;
  }

  /** Absolute path to the generated TypeScript entrypoint. */
  export function mainFile(root: string): string {
    return path.join(root, "src", "main.ts");
  }

  /** Read the generated entrypoint after a test mutates it. */
  export function mainSource(root: string): string {
    return fs.readFileSync(mainFile(root), "utf8");
  }

  /** Assert that the fixture Go plugin replaced the helper call with output. */
  export function assertTransformedToPlugin(code: string): void {
    assert.match(code, /PLUGIN/);
    assert.doesNotMatch(code, /goUpper/);
  }

  /** Extract JavaScript code chunks from Rollup's mixed output array. */
  export function collectRollupOutputCode(output: readonly unknown[]): string {
    return output
      .filter(
        (chunk): chunk is { code: string } =>
          typeof chunk === "object" &&
          chunk !== null &&
          "code" in chunk &&
          typeof (chunk as { code?: unknown }).code === "string",
      )
      .map((chunk) => chunk.code)
      .join("\n");
  }

  /** Write the local CommonJS plugin descriptor consumed by ttsc. */
  export function writePluginEntry(root: string): void {
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      [
        'const path = require("node:path");',
        "",
        "module.exports = (context) => ({",
        '  name: context.plugin.name ?? "fixture",',
        '  source: path.resolve(context.dirname, "go-plugin"),',
        "});",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  /**
   * Add a package-discovered plugin fixture under node_modules.
   *
   * This mirrors the npm package contract where package.json advertises the
   * ttsc plugin entry and the descriptor resolves its own Go source directory.
   */
  export function writePackagePlugin(root: string, packageName: string): void {
    const projectManifest = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          ...projectManifest,
          devDependencies: {
            ...(projectManifest.devDependencies ?? {}),
            [packageName]: "0.0.0",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const packageRoot = path.join(root, "node_modules", packageName);
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify(
        {
          main: "index.cjs",
          name: packageName,
          ttsc: {
            plugin: {
              transform: packageName,
            },
          },
          version: "0.0.0",
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(packageRoot, "index.cjs"),
      [
        'const path = require("node:path");',
        "",
        "module.exports = (context) => ({",
        "  name: context.plugin.name ?? context.plugin.transform,",
        '  source: path.resolve(context.dirname, "go-plugin"),',
        "});",
        "",
      ].join("\n"),
      "utf8",
    );
    writeGoPlugin(packageRoot);
  }

  /**
   * Write the tiny Go transformer used by unplugin adapter tests.
   *
   * The plugin supports multiple operations so adapter tests can prove plugin
   * ordering, generated tsconfig paths, config path absolutization, and cache
   * invalidation without depending on a production utility plugin.
   */
  export function writeGoPlugin(root: string): void {
    fs.mkdirSync(path.join(root, "go-plugin"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "go-plugin", "go.mod"),
      "module example.com/ttscunpluginfixture\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "go-plugin", "main.go"),
      [
        "package main",
        "",
        "import (",
        '  "encoding/json"',
        '  "flag"',
        '  "fmt"',
        '  "os"',
        '  "path/filepath"',
        '  "regexp"',
        '  "strings"',
        ")",
        "",
        'var goUpperCall = regexp.MustCompile(`(?m)export\\s+const\\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\\s*:\\s*[^=]+)?=\\s*goUpper\\("([^"]*)"\\)\\s*;`)',
        "",
        "type pluginDescriptor struct {",
        '  Config map[string]any `json:"config"`',
        '  Name string `json:"name"`',
        '  Stage string `json:"stage"`',
        "}",
        "",
        "type transformResult struct {",
        '  TypeScript map[string]string `json:"typescript"`',
        '  Dependencies map[string][]string `json:"dependencies,omitempty"`',
        "}",
        "",
        "// collectedDependencies is filled by the emit-dependencies operation and",
        "// rides the transform envelope's optional dependencies field.",
        "var collectedDependencies map[string][]string",
        "",
        "func main() { os.Exit(run(os.Args[1:])) }",
        "",
        "func run(args []string) int {",
        "  if len(args) == 0 { return 2 }",
        "  switch args[0] {",
        '  case "transform":',
        "    return transform(args[1:])",
        '  case "check", "version", "build":',
        "    return 0",
        "  default:",
        '    fmt.Fprintf(os.Stderr, "fixture: unknown command %q\\n", args[0])',
        "    return 2",
        "  }",
        "}",
        "",
        "func transform(args []string) int {",
        '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
        "  fs.SetOutput(os.Stderr)",
        '  cwd := fs.String("cwd", "", "")',
        '  tsconfig := fs.String("tsconfig", "", "")',
        '  pluginsJSON := fs.String("plugins-json", "", "")',
        "  if err := fs.Parse(args); err != nil { return 2 }",
        "  root := *cwd",
        '  if root == "" { root, _ = os.Getwd() }',
        '  source, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))',
        "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
        "  plugins, err := parsePlugins(*pluginsJSON)",
        "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
        "  code, err := transformSource(string(source), plugins, *tsconfig, root)",
        "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
        '  data, err := json.Marshal(transformResult{TypeScript: map[string]string{"src/main.ts": code}, Dependencies: collectedDependencies})',
        "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
        "  fmt.Fprintln(os.Stdout, string(data))",
        "  return 0",
        "}",
        "",
        "func parsePlugins(input string) ([]pluginDescriptor, error) {",
        '  if input == "" { return nil, nil }',
        "  var plugins []pluginDescriptor",
        "  if err := json.Unmarshal([]byte(input), &plugins); err != nil { return nil, err }",
        "  return plugins, nil",
        "}",
        "",
        "func transformSource(source string, plugins []pluginDescriptor, tsconfig string, root string) (string, error) {",
        "  match := goUpperCall.FindStringSubmatch(source)",
        '  if match == nil { return "", fmt.Errorf(`expected export const value = goUpper("...")`) }',
        "  name := match[1]",
        "  value := match[2]",
        '  if len(plugins) == 0 { plugins = []pluginDescriptor{{Config: map[string]any{"operation": "go-uppercase"}}} }',
        "  for _, plugin := range plugins {",
        "    switch operation(plugin.Config) {",
        '    case "assert-paths":',
        '      if err := assertPaths(tsconfig, plugin.Config); err != nil { return "", err }',
        "      value = strings.ToUpper(value)",
        '    case "assert-absolute-alias-paths":',
        '      if err := assertAbsoluteAliasPaths(tsconfig, plugin.Config); err != nil { return "", err }',
        "      value = strings.ToUpper(value)",
        '    case "emit-dependencies":',
        "      collectedDependencies = dependenciesFromConfig(plugin.Config)",
        "      value = strings.ToUpper(value)",
        '    case "assert-temp-tsconfig-outside-project":',
        '      if err := assertTempTsconfigOutsideProject(root, tsconfig); err != nil { return "", err }',
        "      value = strings.ToUpper(value)",
        '    case "assert-config-path":',
        '      if err := assertConfigPath(root, plugin.Config); err != nil { return "", err }',
        "      value = strings.ToUpper(value)",
        '    case "read-helper":',
        '      helper, err := os.ReadFile(filepath.Join(root, "src", "helper.ts"))',
        '      if err != nil { return "", err }',
        '      value = strings.ToUpper(value) + ":" + strings.ToUpper(strings.TrimSpace(string(helper)))',
        '    case "read-configured-helper":',
        '      helper, err := os.ReadFile(filepath.Join(root, stringValue(plugin.Config, "path")))',
        '      if err != nil { return "", err }',
        '      value = strings.ToUpper(value) + ":" + strings.ToUpper(strings.TrimSpace(string(helper)))',
        '    case "go-uppercase":',
        "      value = strings.ToUpper(value)",
        '    case "go-prefix":',
        '      value = stringValue(plugin.Config, "prefix") + value',
        '    case "go-suffix":',
        '      value += stringValue(plugin.Config, "suffix")',
        "    default:",
        '      return "", fmt.Errorf("unsupported operation")',
        "    }",
        "  }",
        '  return fmt.Sprintf("export const %s = %q;\\nconsole.log(%s);\\n", name, value, name), nil',
        "}",
        "",
        "func assertPaths(tsconfig string, config map[string]any) error {",
        '  if tsconfig == "" { return fmt.Errorf("missing tsconfig flag") }',
        "  data, err := os.ReadFile(tsconfig)",
        "  if err != nil { return err }",
        "  var parsed map[string]any",
        "  if err := json.Unmarshal(data, &parsed); err != nil { return err }",
        '  compilerOptions, _ := parsed["compilerOptions"].(map[string]any)',
        '  paths, _ := compilerOptions["paths"].(map[string]any)',
        '  key := stringValue(config, "key")',
        '  target := stringValue(config, "target")',
        "  if !pathEntryEquals(paths[key], target) {",
        '    return fmt.Errorf("missing paths entry %s -> %s", key, target)',
        "  }",
        '  if !pathEntryEquals(paths[key+"/*"], target+"/*") {',
        '    return fmt.Errorf("missing paths entry %s/* -> %s/*", key, target)',
        "  }",
        "  return nil",
        "}",
        "",
        "func assertAbsoluteAliasPaths(tsconfig string, config map[string]any) error {",
        '  if tsconfig == "" { return fmt.Errorf("missing tsconfig flag") }',
        "  data, err := os.ReadFile(tsconfig)",
        "  if err != nil { return err }",
        "  var parsed map[string]any",
        "  if err := json.Unmarshal(data, &parsed); err != nil { return err }",
        '  compilerOptions, _ := parsed["compilerOptions"].(map[string]any)',
        '  if _, found := compilerOptions["baseUrl"]; found {',
        '    return fmt.Errorf("generated tsconfig must not declare baseUrl (removed in TypeScript-Go)")',
        "  }",
        '  paths, _ := compilerOptions["paths"].(map[string]any)',
        '  key := stringValue(config, "key")',
        "  entries, ok := paths[key].([]any)",
        "  if !ok || len(entries) == 0 {",
        '    return fmt.Errorf("missing paths entry for %s", key)',
        "  }",
        "  target, _ := entries[0].(string)",
        "  if !filepath.IsAbs(filepath.FromSlash(target)) {",
        '    return fmt.Errorf("paths target for %s is not absolute: %s", key, target)',
        "  }",
        '  if !pathEntryEquals(paths[key+"/*"], target+"/*") {',
        '    return fmt.Errorf("missing paths entry %s/* -> %s/*", key, target)',
        "  }",
        "  return nil",
        "}",
        "",
        "func assertTempTsconfigOutsideProject(root string, tsconfig string) error {",
        '  if tsconfig == "" { return fmt.Errorf("missing tsconfig flag") }',
        "  cleanRoot, err := filepath.Abs(root)",
        "  if err != nil { return err }",
        "  cleanConfig, err := filepath.Abs(tsconfig)",
        "  if err != nil { return err }",
        '  if cleanConfig == filepath.Join(cleanRoot, "tsconfig.json") { return nil }',
        "  rel, err := filepath.Rel(cleanRoot, cleanConfig)",
        "  if err != nil { return err }",
        '  if rel == "." || rel == "" || (!strings.HasPrefix(rel, ".."+string(os.PathSeparator)) && rel != "..") {',
        '    return fmt.Errorf("temporary tsconfig was written under project root: %s", cleanConfig)',
        "  }",
        "  return nil",
        "}",
        "",
        "func assertConfigPath(root string, config map[string]any) error {",
        '  expected := filepath.Join(root, "fixture.config.json")',
        '  actual := stringValue(config, "config")',
        "  if actual != expected {",
        '    return fmt.Errorf("expected config path %s, got %s", expected, actual)',
        "  }",
        "  return nil",
        "}",
        "",
        "// dependenciesFromConfig reads the emit-dependencies operation's",
        '// "dependencies" list and keys it to the transformed file, mirroring how',
        "// a real type-driven plugin reports the sources it consulted.",
        "func dependenciesFromConfig(config map[string]any) map[string][]string {",
        '  raw, _ := config["dependencies"].([]any)',
        "  out := make([]string, 0, len(raw))",
        "  for _, entry := range raw {",
        "    if text, ok := entry.(string); ok {",
        "      out = append(out, text)",
        "    }",
        "  }",
        "  if len(out) == 0 { return nil }",
        '  return map[string][]string{"src/main.ts": out}',
        "}",
        "",
        "func pathEntryEquals(value any, expected string) bool {",
        "  entries, ok := value.([]any)",
        "  if !ok || len(entries) == 0 { return false }",
        "  actual, _ := entries[0].(string)",
        "  return actual == expected",
        "}",
        "",
        "func operation(config map[string]any) string {",
        '  if value, ok := config["operation"].(string); ok && value != "" { return value }',
        '  if _, ok := config["prefix"]; ok { return "go-prefix" }',
        '  if _, ok := config["suffix"]; ok { return "go-suffix" }',
        '  return "go-uppercase"',
        "}",
        "",
        "func stringValue(config map[string]any, key string) string {",
        "  value, _ := config[key].(string)",
        "  return value",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  /**
   * Resolve the native TypeScript `tsc` binary for unplugin tests that call
   * transform APIs directly.
   */
  export function resolveTsgoBinary() {
    const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
      "typescript/package.json",
    );
    const requireFromTypeScript = createRequire(packageJson);
    const platformPackageJson = requireFromTypeScript.resolve(
      `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
    );
    return path.join(
      path.dirname(platformPackageJson),
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    );
  }
}
