/**
 * Shared helpers for tests that exercise the `TtscCompiler` JavaScript API
 * directly (as opposed to spawning the `ttsc` CLI). Provides a thin subclass
 * that injects the shared keyed plugin cache for ordinary scenarios, plus
 * project scaffolding utilities for common fixture shapes (basic CJS project,
 * dotted source directory, source plugin, compiler plugin, etc.).
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveTsgo } from "../../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";
import {
  TtscCompiler as BaseTtscCompiler,
  type ITtscCompilerContext,
} from "../../../../../../packages/ttsc/lib/index.js";

const SHARED_COMPILER_CACHE_DIR = TestProject.sharedPluginCache();

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
  /** Extra `compilerOptions` merged over the fixture's own. */
  compilerOptions?: Record<string, unknown>;
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
          ...(options.compilerOptions ?? {}),
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

/**
 * Install a project-owned package descriptor for the immutable shared backend.
 *
 * These package-discovery cases vary manifest placement and project source,
 * not backend bytes. Source mutation and provenance cases keep private modules.
 *
 * @evidence contracts/common.md#principled-implementation The manifest and descriptor remain inside each consumer package, while their source points to the same immutable authored backend used by configured-plugin cases; discovery ownership changes without changing backend behavior.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns dependency/manifest/descriptor materialization and delegates backend lifetime to getSharedCompilerPluginSource instead of rewriting an identical Go module per consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This shares fixture preparation only; the real loader resolves the project package and builds/executes the authored Go backend, with no substituted product result or changed assertion.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies immutable inputs and the private-source exceptions, separating those grounds from acknowledgment tags.
 * @evidence contracts/performance.md#efficient-algorithms Consumer preparation writes three fixed-size metadata files rather than the backend module again; the initial shared source writer owns the fixed Go source materialization.
 * @evidence contracts/performance.md#reuse-equivalent-work Package-discovery and configured-plugin consumers share identical backend bytes and build settings; their project inputs remain distinct runtime inputs, and mutation/provenance callers use writeCompilerPlugin instead.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One shared source directory is retained for this runner process and owned by TestProject cleanup; each consumer retains only its registered project package files and synchronous command result.
 */
function writePackageCompilerPlugin(root: string, packageName: string) {
  const source = getSharedCompilerPluginSource();
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
      source: ${JSON.stringify(source)}
    };\n`,
    "utf8",
  );
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

function writeCompilerPlugin(root: string) {
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = { name: "compile-fixture", source: "./plugin-go" };\n',
    "utf8",
  );
  writeCompilerPluginBackend(path.join(root, "plugin-go"));
}

let sharedCompilerPluginSource: string | undefined;

/**
 * Materialize the process-owned immutable compiler producer once.
 *
 * These consumers vary project inputs and descriptor options, not Go source.
 * Mutation, source-path and cold-build cases keep writeCompilerPlugin instead.
 * TestProject owns the shared source until all this process's consumers finish.
 */
function getSharedCompilerPluginSource(): string {
  if (sharedCompilerPluginSource === undefined) {
    const source = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-api-compiler-producer-"),
    );
    writeCompilerPluginBackend(source);
    sharedCompilerPluginSource = source;
  }
  return sharedCompilerPluginSource;
}

/** Write this configured-plugin consumer's descriptor for the shared producer. */
function writeSharedCompilerPlugin(root: string): string {
  const source = getSharedCompilerPluginSource();
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `module.exports = { name: "compile-fixture", source: ${JSON.stringify(source)} };\n`,
    "utf8",
  );
  return source;
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
      "type graphSection struct {",
      '\tEdges map[string][]string `json:"edges"`',
      '\tGlobals []string `json:"globals"`',
      '\tConfigs []string `json:"configs"`',
      '\tCandidates map[string][]string `json:"candidates,omitempty"`',
      "}",
      "",
      "type transformResult struct {",
      '\tTypeScript map[string]string `json:"typescript"`',
      '\tDependencies map[string][]string `json:"dependencies,omitempty"`',
      '\tDependenciesComplete []string `json:"dependenciesComplete,omitempty"`',
      '\tGraph *graphSection `json:"graph,omitempty"`',
      '\tVolatile []string `json:"volatile,omitempty"`',
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
      "\t// Report a consulted-source list the way a type-driven plugin would,",
      "\t// so API tests can pin the envelope's optional dependencies field.",
      '\tdeps := map[string][]string{"src/main.ts": {"src/consulted.d.ts"}}',
      "\t// Stamp a reference graph and a volatile list the way a driver-SDK",
      "\t// host would, so API tests can pin the envelope's optional graph and",
      "\t// volatile fields end to end.",
      "\tgraph := &graphSection{",
      '\t\tEdges: map[string][]string{"src/main.ts": {"src/mytype.ts"}},',
      '\t\tGlobals: []string{"src/ambient.d.ts"},',
      '\t\tConfigs: []string{"tsconfig.json"},',
      "\t}",
      "\t// A project may leave a candidate map for the fixture to echo, so API",
      "\t// tests can pin the envelope's optional graph.candidates field without",
      "\t// teaching this fixture anything about a particular project.",
      '\tif raw, readErr := os.ReadFile(filepath.Join(root, "graph-candidates.json")); readErr == nil {',
      "\t\tif err := json.Unmarshal(raw, &graph.Candidates); err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "\t}",
      '\tvolatile := []string{"src/volatile.ts"}',
      "\t// Declare the reported dependency list complete the way a precise",
      "\t// producer would, so API tests can pin the envelope's optional",
      "\t// dependenciesComplete field.",
      '\tcomplete := []string{"src/main.ts"}',
      '\tdata, err := json.Marshal(transformResult{TypeScript: map[string]string{"src/main.ts": output}, Dependencies: deps, DependenciesComplete: complete, Graph: graph, Volatile: volatile})',
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
  writeCompilerPlugin,
  writeCompilerPluginBackend,
  writeSharedCompilerPlugin,
  writeMinimalGoPlugin,
  writePackageCompilerPlugin,
  writePackageSourcePlugin,
  writeProjectDependency,
  writeSourcePlugin,
  writeWarningCheckPlugin,
};
