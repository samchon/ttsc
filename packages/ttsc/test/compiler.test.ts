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

test("TtscCompiler.transform returns project output without project files", () => {
  const root = createProject();
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(result.typescript["dist/main.js"], /api-ok/);
  assert.match(
    result.typescript["dist/main.js"],
    /console\.log\(\s*message\s*\)/,
  );
  assert.match(result.typescript["dist/main.d.ts"], /declare const message/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
});

test("TtscCompiler.transform applies configured source plugins to project output", () => {
  const root = createProject({
    plugins: [{ transform: "./plugin.cjs" }],
    source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
  });
  writeCompilerPlugin(root);
  const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

  const result = compiler.transform();

  assert.equal(result.type, "success");
  assert.match(result.typescript["dist/main.js"], /PLUGIN/);
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
  assert.equal(typeof result.typescript, "object");
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

function createProject(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-compiler-api-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    options.source ??
      'const message: string = "api-ok";\nconsole.log(message);\n',
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
          outDir: "dist",
          declaration: true,
          declarationMap: true,
          rootDir: "src",
          sourceMap: true,
          plugins: options.plugins,
        },
        include: ["src"],
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

function writeCompilerPlugin(root) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "compile-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  fs.mkdirSync(path.join(root, "plugin-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin-go", "go.mod"),
    "module example.com/compilefixture\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin-go", "main.go"),
    [
      "package main",
      "",
      "import (",
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
    ].join("\n"),
    "utf8",
  );
}
