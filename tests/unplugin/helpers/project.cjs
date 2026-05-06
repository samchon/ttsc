const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const requireFromUnplugin = createRequire(
  path.resolve(__dirname, "../../../packages/unplugin/package.json"),
);

process.env.TTSC_TSGO_BINARY ??= resolveTsgoBinary();

function createProject(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unplugin-"));
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

function mainFile(root) {
  return path.join(root, "src", "main.ts");
}

function mainSource(root) {
  return fs.readFileSync(mainFile(root), "utf8");
}

function assertTransformedToPlugin(code) {
  assert.match(code, /PLUGIN/);
  assert.doesNotMatch(code, /goUpper/);
}

function collectRollupOutputCode(output) {
  return output
    .filter((chunk) => "code" in chunk)
    .map((chunk) => chunk.code)
    .join("\n");
}

function writePluginEntry(root) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "fixture",',
      '  source: path.resolve(__dirname, "go-plugin"),',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeGoPlugin(root) {
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
      "}",
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
      '  _ = fs.String("tsconfig", "", "")',
      '  pluginsJSON := fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      '  source, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))',
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  plugins, err := parsePlugins(*pluginsJSON)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  code, err := transformSource(string(source), plugins)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '  data, err := json.Marshal(transformResult{TypeScript: map[string]string{"src/main.ts": code}})',
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
      "func transformSource(source string, plugins []pluginDescriptor) (string, error) {",
      "  match := goUpperCall.FindStringSubmatch(source)",
      '  if match == nil { return "", fmt.Errorf(`expected export const value = goUpper("...")`) }',
      "  name := match[1]",
      "  value := match[2]",
      '  if len(plugins) == 0 { plugins = []pluginDescriptor{{Config: map[string]any{"operation": "go-uppercase"}}} }',
      "  for _, plugin := range plugins {",
      "    switch operation(plugin.Config) {",
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

function resolveTsgoBinary() {
  const packageJson =
    require.resolve("@typescript/native-preview/package.json");
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
}

module.exports = {
  assertTransformedToPlugin,
  collectRollupOutputCode,
  createProject,
  mainFile,
  mainSource,
  requireFromUnplugin,
};
