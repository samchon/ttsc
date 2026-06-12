import {
  assert,
  commonJsProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx rebuilds generated project sources when a
 * dependency-build cache hit does not contain the requested emitted file.
 *
 * Some test runners generate TypeScript files after ttsx's up-front project
 * build has already finished, then import those files in later worker passes.
 * The first generated import builds the owning tsconfig and populates the
 * shared dependency cache. A later generated file under the same tsconfig must
 * refresh that cache when its emitted JavaScript is missing; otherwise ttsx
 * falls back to raw single-file lowering and skips source plugins.
 *
 * 1. Materialize a project with a source plugin that emits every TS file under
 *    `src` and rewrites `cacheMarker("value")` into an uppercase export.
 * 2. Make the ttsx entry generate and require `first.ts`, then generate and
 *    require `second.ts` under the same project.
 * 3. Assert both generated files ran with plugin output, and the source-plugin
 *    binary was built once instead of once per dependency-cache refresh.
 */
export const test_plugin_corpus_ttsx_rebuilds_generated_project_sources_when_dependency_cache_misses =
  () => {
    const root = commonJsProject(
      {
        "plugin.cjs": `
          const path = require("node:path");
          module.exports = {
            name: "generated-cache-plugin",
            source: path.resolve(__dirname, "go-plugin"),
          };
        `,
        "go-plugin/go.mod": `module generated-cache-plugin\n\ngo 1.26\n`,
        "go-plugin/main.go": GO_PLUGIN,
        "src/main.ts": [
          `const fs = require("node:fs");`,
          `const path = require("node:path");`,
          ``,
          `const dir = path.join(__dirname, "generated");`,
          `fs.mkdirSync(dir, { recursive: true });`,
          `const marker = "cache" + "Marker";`,
          ``,
          `fs.writeFileSync(`,
          `  path.join(dir, "first.ts"),`,
          `  'export const value = ' + marker + '("first");\\n',`,
          `);`,
          `console.log(require("./generated/first").value);`,
          ``,
          `fs.writeFileSync(`,
          `  path.join(dir, "second.ts"),`,
          `  'export const value = ' + marker + '("second");\\n',`,
          `);`,
          `console.log(require("./generated/second").value);`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs" }],
        },
      },
    );
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-generated-cache-"),
    );

    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["FIRST", "SECOND"]);
    const sourcePluginBuilds =
      result.stderr.match(/building source plugin "generated-cache-plugin"/g) ??
      [];
    assert.equal(sourcePluginBuilds.length, 1, result.stderr);
  };

const GO_PLUGIN = String.raw`
package main

import (
  "flag"
  "fmt"
  "io/fs"
  "os"
  "path/filepath"
  "regexp"
  "strings"
)

var markerCall = regexp.MustCompile("export\\s+const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*cacheMarker\\(\"([^\"]*)\"\\)\\s*;")

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "generated-cache-plugin: command required")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "generated-cache-plugin 0.0.0-test")
    return 0
  case "check":
    return 0
  case "build":
    return runBuild(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "generated-cache-plugin: unknown command %q\n", args[0])
    return 2
  }
}

func runBuild(args []string) int {
  flags := flag.NewFlagSet("build", flag.ContinueOnError)
  flags.SetOutput(os.Stderr)
  cwd := flags.String("cwd", "", "project directory")
  _ = flags.String("tsconfig", "", "tsconfig")
  _ = flags.String("plugins-json", "", "ordered plugin descriptors")
  _ = flags.Bool("emit", false, "emit")
  _ = flags.Bool("quiet", false, "quiet")
  _ = flags.Bool("noEmit", false, "no emit")
  outDir := flags.String("outDir", "dist", "output directory")
  if err := flags.Parse(args); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  sourceRoot := filepath.Join(root, "src")
  err := filepath.WalkDir(sourceRoot, func(file string, entry fs.DirEntry, err error) error {
    if err != nil || entry.IsDir() || filepath.Ext(file) != ".ts" {
      return err
    }
    rel, err := filepath.Rel(sourceRoot, file)
    if err != nil {
      return err
    }
    text, err := os.ReadFile(file)
    if err != nil {
      return err
    }
    out := filepath.Join(root, *outDir, strings.TrimSuffix(rel, filepath.Ext(rel))+".js")
    if filepath.IsAbs(*outDir) {
      out = filepath.Join(*outDir, strings.TrimSuffix(rel, filepath.Ext(rel))+".js")
    }
    if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
      return err
    }
    return os.WriteFile(out, []byte(transform(string(text))), 0o644)
  })
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return 0
}

func transform(source string) string {
  match := markerCall.FindStringSubmatch(source)
  if match == nil {
    return source
  }
  name := match[1]
  value := strings.ToUpper(match[2])
  return "\"use strict\";\n" +
    "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
    "exports." + name + " = void 0;\n" +
    "const " + name + " = " + fmt.Sprintf("%q", value) + ";\n" +
    "exports." + name + " = " + name + ";\n"
}
`;
