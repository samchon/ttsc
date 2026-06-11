import {
  assert,
  commonJsProject,
  goPath,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx transforms generated sources without build
 * fallback.
 *
 * Generated files created after ttsx's entry build must still receive transform
 * plugin output. This pins the source-to-source cache-miss path: the plugin's
 * `build` command intentionally fails once `src/generated` exists, so the test
 * only passes when the runtime miss is satisfied by the plugin `transform`
 * command and then emitted without plugins.
 *
 * 1. Build an entry that creates and requires generated TypeScript files.
 * 2. Use a native plugin whose `transform` command rewrites `cacheMarker(...)` but
 *    whose `build` command rejects generated runtime fallbacks.
 * 3. Assert small-batch failure falls back to single-file transform, large
 *    generated directories split down to a passing bounded chunk instead of
 *    single-file repetition, and every import prints transformed uppercase
 *    values.
 */
export const test_plugin_corpus_ttsx_transforms_generated_sources_without_build_fallback =
  () => {
    const root = commonJsProject(
      {
        "plugin.cjs": `
          const path = require("node:path");
          module.exports = {
            name: "generated-transform-plugin",
            source: path.resolve(__dirname, "go-plugin"),
          };
        `,
        "go-plugin/go.mod": `module generated-transform-plugin\n\ngo 1.26\n`,
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
          `for (let index = 0; index < 70; index += 1) {`,
          `  fs.writeFileSync(`,
          `    path.join(dir, "extra-" + index + ".ts"),`,
          `    'export const value = ' + marker + '("extra-' + index + '");\\n',`,
          `  );`,
          `}`,
          `fs.writeFileSync(`,
          `  path.join(dir, "third.ts"),`,
          `  'export const value = ' + marker + '("third");\\n',`,
          `);`,
          `console.log(require("./generated/extra-0").value);`,
          `console.log(require("./generated/third").value);`,
          `const markerFile = path.join(__dirname, "..", "large-batch-transform-attempted.txt");`,
          `if (fs.existsSync(markerFile)) throw new Error("oversized generated transform batch was attempted");`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs" }],
        },
      },
    );

    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), [
      "FIRST",
      "SECOND",
      "EXTRA-0",
      "THIRD",
    ]);
  };

const GO_PLUGIN = String.raw`
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "io/fs"
  "os"
  "path/filepath"
  "strings"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: command required")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "generated-transform-plugin 0.0.0-test")
    return 0
  case "check":
    return 0
  case "build":
    return runBuild(args[1:])
  case "transform":
    return runTransform(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "generated-transform-plugin: unknown command %q\n", args[0])
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
  root := projectRoot(*cwd)
  if _, err := os.Stat(filepath.Join(root, "src", "generated")); err == nil {
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: build fallback should not run for generated sources")
    return 2
  }
  return emitJavaScript(root, *outDir)
}

func runTransform(args []string) int {
  flags := flag.NewFlagSet("transform", flag.ContinueOnError)
  flags.SetOutput(os.Stderr)
  cwd := flags.String("cwd", "", "project directory")
  tsconfig := flags.String("tsconfig", "", "tsconfig")
  _ = flags.String("plugins-json", "", "ordered plugin descriptors")
  if err := flags.Parse(args); err != nil {
    return 2
  }
  root := projectRoot(*cwd)
  files, err := selectedTypeScriptFiles(root, *tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  generated := 0
  hasExtraZero := false
  for _, file := range files {
    if strings.Contains(filepath.ToSlash(file), "/src/generated/") {
      generated++
    }
    if strings.HasSuffix(filepath.ToSlash(file), "/src/generated/extra-0.ts") {
      hasExtraZero = true
    }
  }
  if generated > 32 {
    _ = os.WriteFile(filepath.Join(root, "large-batch-transform-attempted.txt"), []byte("oversized batch attempted\n"), 0o644)
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: oversized generated batches should be chunked")
    return 2
  }
  if generated > 16 {
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: large generated batches should be split")
    return 2
  }
  if generated == 1 && hasExtraZero {
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: adaptive split should not fall back to a single extra file")
    return 2
  }
  if generated == 2 {
    fmt.Fprintln(os.Stderr, "generated-transform-plugin: batch transform should fall back to a single file")
    return 2
  }
  typescript := map[string]string{}
  out := map[string]any{
    "diagnostics": []any{},
    "typescript":  typescript,
  }
  for _, file := range files {
    rel, err := filepath.Rel(root, file)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    text, err := os.ReadFile(file)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    typescript[filepath.ToSlash(rel)] = transformTypeScript(string(text))
  }
  if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return 0
}

func projectRoot(cwd string) string {
  if cwd != "" {
    return cwd
  }
  root, err := os.Getwd()
  if err != nil {
    return "."
  }
  return root
}

func selectedTypeScriptFiles(root string, tsconfig string) ([]string, error) {
  if tsconfig != "" {
    var parsed struct {
      Files []string
    }
    text, err := os.ReadFile(tsconfig)
    if err != nil {
      return nil, err
    }
    if err := json.Unmarshal(text, &parsed); err != nil {
      return nil, err
    }
    if len(parsed.Files) != 0 {
      files := make([]string, 0, len(parsed.Files))
      for _, file := range parsed.Files {
        if filepath.IsAbs(file) {
          files = append(files, file)
        } else {
          files = append(files, filepath.Join(filepath.Dir(tsconfig), file))
        }
      }
      return files, nil
    }
  }
  files := []string{}
  err := filepath.WalkDir(filepath.Join(root, "src"), func(file string, entry fs.DirEntry, err error) error {
    if err != nil || entry.IsDir() || filepath.Ext(file) != ".ts" {
      return err
    }
    files = append(files, file)
    return nil
  })
  return files, err
}

func emitJavaScript(root string, outDir string) int {
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
    out := filepath.Join(root, outDir, strings.TrimSuffix(rel, filepath.Ext(rel))+".js")
    if filepath.IsAbs(outDir) {
      out = filepath.Join(outDir, strings.TrimSuffix(rel, filepath.Ext(rel))+".js")
    }
    if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
      return err
    }
    return os.WriteFile(out, []byte(transformJavaScript(string(text))), 0o644)
  })
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return 0
}

func transformTypeScript(source string) string {
  value, ok := markerValue(source)
  if !ok {
    return source
  }
  return "export const value = " + fmt.Sprintf("%q", strings.ToUpper(value)) + ";\n"
}

func transformJavaScript(source string) string {
  transformed := transformTypeScript(source)
  value, ok := exportedValue(transformed)
  if !ok {
    return source
  }
  return "\"use strict\";\n" +
    "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
    "exports.value = void 0;\n" +
    "const value = " + fmt.Sprintf("%q", value) + ";\n" +
    "exports.value = value;\n"
}

func markerValue(source string) (string, bool) {
  prefix := "cacheMarker(\""
  start := strings.Index(source, prefix)
  if start < 0 {
    return "", false
  }
  rest := source[start+len(prefix):]
  end := strings.Index(rest, "\")")
  if end < 0 {
    return "", false
  }
  return rest[:end], true
}

func exportedValue(source string) (string, bool) {
  prefix := "export const value = \""
  start := strings.Index(source, prefix)
  if start < 0 {
    return "", false
  }
  rest := source[start+len(prefix):]
  end := strings.Index(rest, "\"")
  if end < 0 {
    return "", false
  }
  return rest[:end], true
}
`;
