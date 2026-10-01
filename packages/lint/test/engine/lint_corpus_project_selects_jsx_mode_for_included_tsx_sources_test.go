package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestLintCorpusProjectSelectsJSXModeForIncludedTSXSources verifies how an entry
// becomes a project: source paths, companions, rules and JSX mode.
//
// A TSX fixture must keep its extension and enable JSX parsing, and a project
// with a TSX companion under `src/` makes the same decision, whatever separator
// the companion path used. TypeScript-only projects and a TSX file outside the
// included `src/` tree keep the non-JSX shape. Companion sources are written once
// at their `src/` path, and the entry's rules become its lint.config.json.
//
// 1. Resolve default, TSX and renamed source paths.
// 2. Materialize default, TSX, TS-companion, TSX-companion and nested-companion
//    projects.
// 3. Assert the files written, the generated lint config, and that only projects
//    including a TSX source select `react-jsx`.
//
// @evidence contracts/testing.md#behavioral-verification corpusResolveSourcePath and materializeCorpusProject write real project trees whose files, lint.config.json and tsconfig compilerOptions.jsx are read back and compared.
// @evidence contracts/testing.md#independent-expectations The default `src/main<suffix>` placement, the `react-jsx` mode for included TSX and the rule/option tuple in lint.config.json follow the corpus format and the compiler's JSX option; they are literals written from that format, not read from loader output.
// @evidence contracts/testing.md#distinguishing-cases A default TS project and a TS companion stay non-JSX while a TSX entry, a TSX companion and a nested-separator TSX companion select JSX; a src/ doubled path must not exist; a TSX file outside src/ and an escaping path are rejected.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusProjectSelectsJSXModeForIncludedTSXSourcesis a discoverable Go unit entry that writes and reads t.TempDir files only; no compiler or lint host runs on the projects.
func TestLintCorpusProjectSelectsJSXModeForIncludedTSXSources(t *testing.T) {
  for _, row := range []struct{ fixture, source, want string }{
    {"no-console.ts", "", "src/main.ts"},
    {"react/jsx-key.tsx", "", "src/main.tsx"},
    {"module.mts", "", "src/main.mts"},
    {"types.d.cts", "", "src/main.d.cts"},
    {"react/jsx-key.tsx", "// @ttsc-corpus-filename: src/components/Named.tsx\n", "src/components/Named.tsx"},
  } {
    got, err := corpusResolveSourcePath(row.source, row.fixture)
    if err != nil || got != row.want {
      t.Fatalf("%s: got %q %v, want %q", row.fixture, got, err, row.want)
    }
  }

  for _, scenario := range []struct {
    name       string
    sourcePath string
    source     string
    companions map[string]string
    written    []string
    absent     []string
    jsx        bool
  }{
    {"default-ts", "src/main.ts", "export const value = 1;\n", nil, []string{"src/main.ts"}, []string{"src/main.tsx"}, false},
    {"default-tsx", "src/main.tsx", "export const value = <div />;\n", nil, []string{"src/main.tsx"}, []string{"src/main.ts"}, true},
    {"ts-companion", "src/main.ts", "export const value = 1;\n", map[string]string{"src/companion.ts": "export const companion = 2;\n"}, []string{"src/main.ts", "src/companion.ts"}, []string{"src/src/companion.ts"}, false},
    {"tsx-companion", "src/main.ts", "export const value = 1;\n", map[string]string{"src/companion.tsx": "export const companion = <div />;\n"}, []string{"src/companion.tsx"}, nil, true},
    {"windows-separator-tsx-companion", "src/main.ts", "export const value = 1;\n", map[string]string{`src\nested\companion.tsx`: "export const companion = <div />;\n"}, []string{"src/nested/companion.tsx"}, nil, true},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      root := t.TempDir()
      entry := corpusEntry{
        RelativeFile: scenario.name + ".ts",
        Source:       scenario.source,
        SourcePath:   scenario.sourcePath,
        Rules:        map[string]any{"fixture/rule": []any{"error", map[string]any{"limit": 1}}},
        Companions:   scenario.companions,
      }
      if err := materializeCorpusProject(root, entry); err != nil {
        t.Fatal(err)
      }
      for _, name := range scenario.written {
        if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(name))); err != nil {
          t.Fatalf("%s must be written: %v", name, err)
        }
      }
      for _, name := range scenario.absent {
        if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(name))); err == nil {
          t.Fatalf("%s must not be written", name)
        }
      }
      var tsconfig struct {
        CompilerOptions map[string]any
        Include         []string
      }
      readCorpusJSON(t, filepath.Join(root, "tsconfig.json"), &tsconfig)
      jsx, hasJSX := tsconfig.CompilerOptions["jsx"]
      if hasJSX != scenario.jsx || (hasJSX && jsx != "react-jsx") || len(tsconfig.Include) != 1 || tsconfig.Include[0] != "src" {
        t.Fatalf("jsx mode %v/%v include %v, want jsx=%v under src", jsx, hasJSX, tsconfig.Include, scenario.jsx)
      }
      var config struct{ Rules map[string][]any }
      readCorpusJSON(t, filepath.Join(root, "lint.config.json"), &config)
      tuple := config.Rules["fixture/rule"]
      if len(tuple) != 2 || tuple[0] != "error" {
        t.Fatalf("lint.config.json rules %+v", config.Rules)
      }
    })
  }

  for name, entry := range map[string]corpusEntry{
    "outside-src": {RelativeFile: "a.ts", SourcePath: "src/main.ts", Companions: map[string]string{"outside.tsx": "export {};\n"}},
    "escaping":    {RelativeFile: "b.ts", SourcePath: "src/../../outside.ts"},
    "colliding":   {RelativeFile: "c.ts", SourcePath: "src/main.ts", Companions: map[string]string{`SRC\MAIN.ts`: "export {};\n"}},
  } {
    if err := materializeCorpusProject(t.TempDir(), entry); err == nil {
      t.Fatalf("%s: want a rejected project", name)
    }
  }
}

func readCorpusJSON(t *testing.T, location string, into any) {
  t.Helper()
  data, err := os.ReadFile(location)
  if err != nil {
    t.Fatal(err)
  }
  if err := json.Unmarshal(data, into); err != nil {
    t.Fatal(err)
  }
}
