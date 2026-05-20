/**
 * Shared helpers for tests that exercise the `TtscCompiler` JavaScript API
 * directly (as opposed to spawning the `ttsc` CLI). Provides a thin subclass
 * that injects a per-suite `TTSC_CACHE_DIR` so concurrent test runs do not
 * share cache state, plus project scaffolding utilities for common fixture
 * shapes (basic CJS project, dotted source directory, source plugin, compiler
 * plugin, etc.).
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveTsgo } from "../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import {
  TtscCompiler as BaseTtscCompiler,
  type ITtscCompilerContext,
} from "../../../../packages/ttsc/lib/index.js";

const SHARED_COMPILER_CACHE_DIR = TestProject.tmpdir(
  "ttsc-compiler-api-cache-",
);

class TtscCompiler extends BaseTtscCompiler {
  public constructor(context: ITtscCompilerContext = {}) {
    super(
      context.cacheDir
        ? context
        : {
            ...context,
            env: {
              TTSC_CACHE_DIR: SHARED_COMPILER_CACHE_DIR,
              ...context.env,
            },
          },
    );
  }
}

const ttscPackageRoot = path.join(
  TestProject.WORKSPACE_ROOT,
  "packages",
  "ttsc",
);
const tsgo = resolveTsgo({ cwd: ttscPackageRoot }).binary;

interface ICompilerApiProjectOptions {
  files?: Record<string, string>;
  include?: string[];
  outDir?: string;
  plugins?: unknown[];
  rootDir?: string;
  source?: string;
}

function createProject(options: ICompilerApiProjectOptions = {}) {
  const root = TestProject.tmpdir("ttsc-compiler-api-");
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

function writeBasicProject(
  root: string,
  source: string,
  options: ICompilerApiProjectOptions = {},
) {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "main.ts"), source, "utf8");
  for (const [file, content] of Object.entries(options.files ?? {}) as [
    string,
    string,
  ][]) {
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
  const root = TestProject.tmpdir("ttsc-compiler-api-");
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

function writeSourcePlugin(root: string) {
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

function writePackageSourcePlugin(root: string, packageName: string) {
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

function writePackageCompilerPlugin(root: string, packageName: string) {
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

function writeProjectDependency(root: string, packageName: string) {
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

function writeWarningCheckPlugin(root: string) {
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

function writeMinimalGoPlugin(root: string) {
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

function writeBrokenTransformPlugin(root: string) {
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

function writeArrayTransformPlugin(root: string) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "array-transform-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  fs.mkdirSync(path.join(root, "plugin-go"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "plugin-go", "go.mod"),
    "module example.com/arraytransformfixture\n\ngo 1.26\n",
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
      '\t\tfmt.Println(`{"typescript":["not-a-source-map"]}`)',
      "\t\treturn",
      "\t}",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeCompilerPlugin(root: string) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "compile-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  writeCompilerPluginBackend(path.join(root, "plugin-go"));
}

function writeCompilerPluginBackend(pluginRoot: string) {
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

function expectArrayValue<T>(values: readonly T[], index: number): T {
  const value = values[index];
  assert.ok(value, `Expected array value at index ${index}`);
  return value;
}

function expectRecordValue(
  values: Record<string, string>,
  key: string,
): string {
  const value = values[key];
  assert.ok(value, `Expected record value for ${key}`);
  return value;
}

export {
  TtscCompiler,
  assert,
  createDottedSourceProject,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  os,
  path,
  resolveTsgo,
  tsgo,
  ttscPackageRoot,
  writeBasicProject,
  writeArrayTransformPlugin,
  writeBrokenTransformPlugin,
  writeCompilerPlugin,
  writeCompilerPluginBackend,
  writeMinimalGoPlugin,
  writePackageCompilerPlugin,
  writePackageSourcePlugin,
  writeProjectDependency,
  writeSourcePlugin,
  writeWarningCheckPlugin,
};
