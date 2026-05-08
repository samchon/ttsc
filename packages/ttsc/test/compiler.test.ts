const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { TtscCompiler } = require("../lib/index.js");
const { resolveTsgo } = require("../lib/compiler/internal/resolveTsgo.js");
const tsgo = resolveTsgo({ cwd: path.resolve(__dirname, "..") }).binary;

test("TtscCompiler.compile returns output without writing project files", () => {
  const root = createProject();
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /api-ok/);
  assert.match(result.output["dist/main.js"], /console\.log\(\s*message\s*\)/);
  assert.match(result.output["dist/main.d.ts"], /declare const message/);
  assert.match(result.output["dist/main.js.map"], /"version":3/);
  assert.match(result.output["dist/main.d.ts.map"], /"version":3/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.compile keeps relative keys for internal dotted output directories", () => {
  const root = createProject({
    outDir: "..dist",
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["..dist/main.js"], /api-ok/);
  assert.equal(
    Object.keys(result.output).some((key) => path.isAbsolute(key)),
    false,
  );
  assert.equal(fs.existsSync(path.join(root, "..dist")), false);
});

test("TtscCompiler can disable project plugin loading", () => {
  const root = createProject({
    plugins: [{ transform: "./missing-plugin.cjs" }],
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "success");
});

test("TtscCompiler.compile applies configured source plugins without project output", () => {
  const root = createProject({
    plugins: [{ transform: "./plugin.cjs" }],
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writeCompilerPlugin(root);
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /PLUGIN/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.compile applies package-discovered source plugins", () => {
  const root = createProject({
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writePackageCompilerPlugin(root, "compile-fixture");
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /PLUGIN/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.compile discovers package plugins from ancestor package.json", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-workspace-"));
  const project = path.join(workspace, "packages", "app");
  writeBasicProject(
    project,
    'declare function goUpper(value: string): string;\nexport const value = goUpper("plugin");\nconsole.log(value);\n',
  );
  writePackageCompilerPlugin(workspace, "compile-fixture");
  const compiler = new TtscCompiler({ binary: tsgo, cwd: project });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /PLUGIN/);
  assert.equal(fs.existsSync(path.join(project, "dist")), false);
});

test("TtscCompiler.compile stops package plugin discovery at nearest package.json", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-workspace-"));
  const project = path.join(workspace, "packages", "app");
  writeBasicProject(
    project,
    'declare function goUpper(value: string): string;\nexport const value = goUpper("plugin");\nconsole.log(value);\n',
  );
  writePackageCompilerPlugin(workspace, "compile-fixture");
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({ private: true }),
    "utf8",
  );
  const compiler = new TtscCompiler({ binary: tsgo, cwd: project });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /goUpper\("plugin"\)/);
  assert.doesNotMatch(result.output["dist/main.js"], /PLUGIN/);
  assert.equal(fs.existsSync(path.join(project, "dist")), false);
});

test("TtscCompiler.transform returns TypeScript source without project files", () => {
  const root = createProject();
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(
    result.typescript["src/main.ts"],
    /const message: string = "api-ok"/,
  );
  assert.match(
    result.typescript["src/main.ts"],
    /console\.log\(\s*message\s*\)/,
  );
  assert.equal(result.typescript["dist/main.js"], undefined);
  assert.equal(result.typescript["dist/main.d.ts"], undefined);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform returns every included TypeScript source file", () => {
  const root = createProject({
    files: {
      "src/helpers.ts":
        "export const helper = (value: string): string => value.toUpperCase();\n",
      "src/nested/model.ts": "export interface Model { value: string }\n",
    },
    source:
      'import { helper } from "./helpers";\nconst message: string = helper("api-ok");\nconsole.log(message);\n',
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(result.typescript["src/main.ts"], /helper\("api-ok"\)/);
  assert.match(result.typescript["src/helpers.ts"], /toUpperCase/);
  assert.match(result.typescript["src/nested/model.ts"], /interface Model/);
  for (const key of Object.keys(result.typescript)) {
    assert.equal(key.startsWith("dist/"), false);
    assert.equal(/\.(?:js|cjs|mjs|d\.ts|map)$/.test(key), false);
  }
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform keeps relative keys for internal dotted source directories", () => {
  const root = createDottedSourceProject();
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(result.typescript["..src/main.ts"], /dotted-source/);
  assert.equal(
    Object.keys(result.typescript).some((key) => path.isAbsolute(key)),
    false,
  );
});

test("TtscCompiler.transform applies configured source plugins to TypeScript output", () => {
  const root = createProject({
    plugins: [{ transform: "./plugin.cjs" }],
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writeCompilerPlugin(root);
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(
    result.typescript["src/main.ts"],
    /export const value = "PLUGIN"/,
  );
  assert.match(result.typescript["src/main.ts"], /console\.log\(value\)/);
  assert.equal(result.typescript["dist/main.js"], undefined);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform applies package-discovered source plugins", () => {
  const root = createProject({
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writePackageCompilerPlugin(root, "compile-fixture");
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(
    result.typescript["src/main.ts"],
    /export const value = "PLUGIN"/,
  );
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform preserves warning diagnostics from check plugins", () => {
  const root = createProject({
    plugins: [{ transform: "./check-plugin.cjs" }],
  });
  writeWarningCheckPlugin(root);
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.equal(result.diagnostics?.length, 1);
  assert.equal(result.diagnostics?.[0].category, "warning");
  assert.equal(result.diagnostics?.[0].code, 9001);
  assert.match(result.typescript["src/main.ts"], /api-ok/);
});

test("TtscCompiler.transform rejects plugin output that is not TypeScript source", () => {
  const root = createProject({
    plugins: [{ transform: "./plugin.cjs" }],
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writeBrokenTransformPlugin(root);
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.transform();

  assert.equal(result.type, "exception");
  assert.match(result.error.message, /did not return a TypeScript source map/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform returns failure on compiler diagnostics", () => {
  const root = createProject({
    source: 'const value: number = "not-a-number";\nconsole.log(value);\n',
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.transform();

  assert.equal(result.type, "failure");
  assert.equal(result.diagnostics[0].code, 2322);
  assert.match(result.typescript["src/main.ts"], /not-a-number/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.compile returns structured diagnostics", () => {
  const root = createProject({
    source: 'const value: number = "not-a-number";\nconsole.log(value);\n',
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "failure");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].code, 2322);
  assert.equal(typeof result.diagnostics[0].start, "number");
  assert.equal(typeof result.diagnostics[0].length, "number");
  assert.equal(result.diagnostics[0].line, 1);
  assert.equal(result.diagnostics[0].character, 7);
  assert.equal(result.diagnostics[0].file.endsWith("src/main.ts"), true);
  assert.match(result.diagnostics[0].messageText, /not assignable/);
  assert.equal(typeof result.output, "object");
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.compile does not accept per-call context overrides", () => {
  const root = createProject();
  const other = createProject({
    plugins: [{ transform: "./missing-plugin.cjs" }],
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile({
    binary: path.join(other, "missing-tsgo"),
    cwd: other,
    plugins: [{ transform: "./missing-plugin.cjs" }],
  });

  assert.equal(result.type, "success");
  assert.match(result.output["dist/main.js"], /api-ok/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
  assert.equal(fs.existsSync(path.join(other, "dist")), false);
});

test("TtscCompiler.prepare builds source plugins and clean removes context cache", () => {
  const root = createProject({
    plugins: [{ transform: "./plugin.cjs" }],
  });
  writeSourcePlugin(root);
  const cacheDir = path.join(root, ".cache", "ttsc");
  const compiler = new TtscCompiler({ binary: tsgo, cacheDir, cwd: root });

  const prepared = compiler.prepare();

  assert.equal(prepared.length, 1);
  assert.equal(fs.existsSync(prepared[0]), true);
  assert.equal(prepared[0].startsWith(path.join(cacheDir, "plugins")), true);

  const removed = compiler.clean();

  assert.deepEqual(removed, [cacheDir]);
  assert.equal(fs.existsSync(cacheDir), false);
});

test("TtscCompiler.prepare honors projectRoot when tsconfig is outside the project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-compiler-api-"));
  const project = path.join(root, "project");
  const config = path.join(root, "config");
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({
      private: true,
      devDependencies: {
        "prepare-fixture": "0.0.0",
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(config, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
      },
    }),
    "utf8",
  );
  writePackageSourcePlugin(project, "prepare-fixture");
  const cacheDir = path.join(project, ".cache", "ttsc");
  const compiler = new TtscCompiler({
    binary: tsgo,
    cacheDir,
    cwd: root,
    projectRoot: "project",
    tsconfig: "config/tsconfig.json",
  });

  const prepared = compiler.prepare();

  assert.equal(prepared.length, 1);
  assert.equal(fs.existsSync(prepared[0]), true);
  assert.equal(prepared[0].startsWith(path.join(cacheDir, "plugins")), true);
});

function createProject(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-compiler-api-"));
  writeBasicProject(
    root,
    options.source ??
      'const message: string = "api-ok";\nconsole.log(message);\n',
    options,
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true }),
    "utf8",
  );
  return root;
}

function writeBasicProject(root, source, options = {}) {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    source,
    "utf8",
  );
  for (const [file, content] of Object.entries(options.files ?? {})) {
    const location = path.join(root, file);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, content, "utf8");
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: options.outDir ?? "dist",
          declaration: true,
          declarationMap: true,
          rootDir: options.rootDir ?? "src",
          sourceMap: true,
          plugins: options.plugins,
        },
        include: options.include ?? ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
}

function createDottedSourceProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-compiler-api-"));
  fs.mkdirSync(path.join(root, "..src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "..src", "main.ts"),
    'export const value: string = "dotted-source";\n',
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
          rootDir: "..src",
          outDir: "dist",
        },
        files: ["..src/main.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  return root;
}

function writeSourcePlugin(root) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "prepare-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  fs.mkdirSync(path.join(root, "plugin-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin-go", "go.mod"),
    "module example.com/preparefixture\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin-go", "main.go"),
    "package main\n\nfunc main() {}\n",
    "utf8",
  );
}

function writePackageSourcePlugin(root, packageName) {
  const packageRoot = path.join(root, "node_modules", packageName);
  writeProjectDependency(root, packageName);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      main: "index.cjs",
      name: packageName,
      ttsc: {
        plugin: {
          transform: packageName,
        },
      },
      version: "0.0.0",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    `module.exports = {
      name: ${JSON.stringify(packageName)},
      source: ${JSON.stringify(path.join(packageRoot, "plugin-go"))}
    };\n`,
    "utf8",
  );
  writeMinimalGoPlugin(packageRoot);
}

function writePackageCompilerPlugin(root, packageName) {
  const packageRoot = path.join(root, "node_modules", packageName);
  writeProjectDependency(root, packageName);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      main: "index.cjs",
      name: packageName,
      ttsc: {
        plugin: {
          transform: packageName,
        },
      },
      version: "0.0.0",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    `module.exports = {
      name: ${JSON.stringify(packageName)},
      source: ${JSON.stringify(path.join(packageRoot, "plugin-go"))}
    };\n`,
    "utf8",
  );
  writeCompilerPluginBackend(path.join(packageRoot, "plugin-go"));
}

function writeProjectDependency(root, packageName) {
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      devDependencies: {
        [packageName]: "0.0.0",
      },
    }),
    "utf8",
  );
}

function writeWarningCheckPlugin(root) {
  fs.writeFileSync(
    path.join(root, "check-plugin.cjs"),
    'module.exports = { name: "warning-check", source: "./check-go", stage: "check" };\n',
    "utf8",
  );
  fs.mkdirSync(path.join(root, "check-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "check-go", "go.mod"),
    "module example.com/warningcheck\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "check-go", "main.go"),
    [
      "package main",
      "",
      "import (",
      '\t"fmt"',
      '\t"os"',
      ")",
      "",
      "func main() {",
      '\tif len(os.Args) > 1 && os.Args[1] == "check" {',
      '\t\tfmt.Fprintln(os.Stderr, "src/main.ts(1,1): warning TS9001: check warning")',
      "\t}",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeMinimalGoPlugin(root) {
  fs.mkdirSync(path.join(root, "plugin-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin-go", "go.mod"),
    "module example.com/packagepreparefixture\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin-go", "main.go"),
    "package main\n\nfunc main() {}\n",
    "utf8",
  );
}

function writeBrokenTransformPlugin(root) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "broken-transform-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  fs.mkdirSync(path.join(root, "plugin-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin-go", "go.mod"),
    "module example.com/brokentransformfixture\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin-go", "main.go"),
    [
      "package main",
      "",
      "import (",
      '\t"fmt"',
      '\t"os"',
      ")",
      "",
      "func main() {",
      '\tif len(os.Args) > 1 && os.Args[1] == "transform" {',
      '\t\tfmt.Println(`{"output":{"dist/main.js":"console.log(\\"wrong\\");\\n"}}`)',
      "\t\treturn",
      "\t}",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeCompilerPlugin(root) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "compile-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  writeCompilerPluginBackend(path.join(root, "plugin-go"));
}

function writeCompilerPluginBackend(pluginRoot) {
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, "go.mod"),
    "module example.com/compilefixture\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(pluginRoot, "main.go"),
    [
      "package main",
      "",
      "import (",
      '\t"encoding/json"',
      '\t"flag"',
      '\t"fmt"',
      '\t"os"',
      '\t"path/filepath"',
      '\t"strings"',
      ")",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "\tif len(args) == 0 { return 2 }",
      "\tswitch args[0] {",
      '\tcase "build":',
      "\t\treturn build(args[1:])",
      '\tcase "transform":',
      "\t\treturn transformSource(args[1:])",
      '\tcase "check", "version":',
      "\t\treturn 0",
      "\tdefault:",
      "\t\treturn 2",
      "\t}",
      "}",
      "",
      "func build(args []string) int {",
      '\tfs := flag.NewFlagSet("build", flag.ContinueOnError)',
      "\tfs.SetOutput(os.Stderr)",
      '\tcwd := fs.String("cwd", "", "")',
      '\toutDir := fs.String("outDir", "dist", "")',
      '\t_ = fs.String("tsconfig", "", "")',
      '\t_ = fs.String("plugins-json", "", "")',
      '\t_ = fs.Bool("emit", false, "")',
      '\t_ = fs.Bool("quiet", false, "")',
      '\t_ = fs.Bool("verbose", false, "")',
      '\t_ = fs.Bool("noEmit", false, "")',
      "\tif err := fs.Parse(args); err != nil { return 2 }",
      "\troot := *cwd",
      '\tif root == "" { root, _ = os.Getwd() }',
      '\tinput, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))',
      "\tif err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '\tvalue := "PLUGIN"',
      '\tif !strings.Contains(string(input), `goUpper("plugin")`) { value = "UNKNOWN" }',
      '\toutput := fmt.Sprintf("\\"use strict\\";\\nObject.defineProperty(exports, \\"__esModule\\", { value: true });\\nexports.value = void 0;\\nconst value = %q;\\nexports.value = value;\\nconsole.log(value);\\n", value)',
      '\tfile := filepath.Join(*outDir, "main.js")',
      '\tif !filepath.IsAbs(*outDir) { file = filepath.Join(root, *outDir, "main.js") }',
      "\tif err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "\tif err := os.WriteFile(file, []byte(output), 0o644); err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "\treturn 0",
      "}",
      "",
      "type transformResult struct {",
      '\tTypeScript map[string]string `json:"typescript"`',
      "}",
      "",
      "func transformSource(args []string) int {",
      '\tfs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "\tfs.SetOutput(os.Stderr)",
      '\tcwd := fs.String("cwd", "", "")',
      '\t_ = fs.String("tsconfig", "", "")',
      '\t_ = fs.String("plugins-json", "", "")',
      "\tif err := fs.Parse(args); err != nil { return 2 }",
      "\troot := *cwd",
      '\tif root == "" { root, _ = os.Getwd() }',
      '\tinput, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))',
      "\tif err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '\tvalue := "PLUGIN"',
      '\tif !strings.Contains(string(input), `goUpper("plugin")`) { value = "UNKNOWN" }',
      '\toutput := fmt.Sprintf("export const value = %q;\\nconsole.log(value);\\n", value)',
      '\tdata, err := json.Marshal(transformResult{TypeScript: map[string]string{"src/main.ts": output}})',
      "\tif err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "\tfmt.Fprintln(os.Stdout, string(data))",
      "\treturn 0",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}
