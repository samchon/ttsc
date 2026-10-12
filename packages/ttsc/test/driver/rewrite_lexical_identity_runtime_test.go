package driver_test

import (
  "fmt"
  "path/filepath"
  "reflect"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteLexicalIdentityRuntime Verifies emitted call identity through
// both public rewrite emit operations and actual JavaScript module loading.
//
// One immutable Program serves whole-program, targeted and raw emission. Marker
// data and call-shaped strings, comments, regex and template text coexist with
// executable template substitutions, nested calls and distinct receiver names.
// Node loads each independent output and reports actual string exports.
//
// 1. Copy the authored lexical fixtures and load their compiler Program once.
// 2. Register ordered replacements and emit with EmitAll and EmitFile separately.
// 3. Check raw output, map preservation, genuine marker idempotence and writer errors.
// 4. Load all successful JavaScript outputs in one Node process and compare literal exports.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram, RewriteSet, EmitAll and EmitFile produce actual JavaScript that Node requires; exact string exports distinguish preserved inert text and receiver names from ordered transformed calls. Raw output retains its calls, maps stay byte-identical, repeated marked output stays byte-identical and a failing writer remains an emit diagnostic.
// @evidence contracts/testing.md#independent-expectations Literal original, adjacent, marker and call-text values follow the authored fixtures; first, inside, outer:inner and unicode-replaced follow the independent registered replacement contract. Expectations are never supplied to Node.
// @evidence contracts/testing.md#distinguishing-cases Marker strings and nonheader comments, quoted/template/regex/comment call decoys, a longer Unicode root and a qualified receiver contrast with live calls, executable template substitutions, consuming nested arguments, callee-only outer plus consuming inner and a Unicode property chain. Whole-program, targeted and raw modes share immutable inputs but keep independent outputs and failure identities.
// @evidence contracts/testing.md#execution-ownership This Go unit directly invokes the owning compiler library and uses Node only as an independent JavaScript validity/value oracle. It builds no native host and installs no consumer; TestDriverRewriteLexicalIdentityRuntime is the selectable entry, with mode/source subcases retaining their failure identities.
func TestDriverRewriteLexicalIdentityRuntime(t *testing.T) {
  root := t.TempDir()
  if err := copyRewriteRuntimeFixtures(root); err != nil {
    t.Fatal(err)
  }
  projectRoot := filepath.Join(root, "lexical")
  program, diagnostics, err := driver.LoadProgram(projectRoot, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil || len(diagnostics) != 0 || program == nil {
    t.Fatalf("LoadProgram: diagnostics=%#v err=%v", diagnostics, err)
  }
  defer program.Close()
  rewrites := driver.NewRewriteSet()
  marker := program.SourceFile(filepath.Join(projectRoot, "marker.ts"))
  contexts := program.SourceFile(filepath.Join(projectRoot, "contexts.ts"))
  if marker == nil || contexts == nil {
    t.Fatal("SourceFile did not find both lexical fixtures")
  }
  rewrites.Add(driver.Rewrite{File: marker, RootName: "plugin", Method: "make", Replacement: `"marker-replaced"`, ConsumeParens: true})
  for _, replacement := range []struct { text string; consume bool }{
    {`"first"`, true}, {`"inside"`, true}, {`(input => "outer:" + input)`, false}, {`"inner"`, true},
  } {
    rewrites.Add(driver.Rewrite{File: contexts, RootName: "plugin", Namespaces: []string{"ns"}, Method: "make", Replacement: replacement.text, ConsumeParens: replacement.consume})
  }
  rewrites.Add(driver.Rewrite{File: contexts, RootName: "플러그인", Namespaces: []string{"네임"}, Method: "만들기", Replacement: `"unicode-replaced"`, ConsumeParens: true})

  raw := map[string]string{}
  _, rawDiagnostics, rawErr := program.EmitAllRaw(func(name shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    raw[filepath.Base(name.AsString())] = text
    return nil
  })
  if rawErr != nil || len(rawDiagnostics) != 0 {
    t.Errorf("raw emit: diagnostics=%#v err=%v", rawDiagnostics, rawErr)
  }
  if !strings.Contains(raw["marker.js"], "plugin.make()") || !strings.Contains(raw["contexts.js"], "plugin.ns.make(\"inner\")") {
    t.Error("raw emission did not preserve registered calls")
  }

  inputs := []rewriteRuntimeInput{}
  for _, mode := range []string{"all", "file"} {
    emitted := map[string]string{}
    writer := func(name shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
      base := filepath.Base(name.AsString())
      emitted[base] = text
      return driver.DefaultWriteFile(filepath.Join(root, mode, base), text)
    }
    if mode == "all" {
      _, diagnostics, err = program.EmitAll(rewrites, writer)
      if err != nil || len(diagnostics) != 0 {
        t.Errorf("%s emit: diagnostics=%#v err=%v", mode, diagnostics, err)
      }
    } else {
      for _, target := range []string{"marker.ts", "contexts.ts"} {
        _, diagnostics, err = program.EmitFile(rewrites, program.SourceFile(filepath.Join(projectRoot, target)), writer)
        if err != nil || len(diagnostics) != 0 {
          t.Errorf("%s/%s emit: diagnostics=%#v err=%v", mode, target, diagnostics, err)
        }
      }
    }
    for _, source := range []string{"marker", "contexts"} {
      t.Run(mode+"/"+source+"/output", func(t *testing.T) {
        js := emitted[source+".js"]
        if js == "" {
          t.Fatal("missing JavaScript output")
        }
        if emitted[source+".js.map"] == "" || emitted[source+".js.map"] != raw[source+".js.map"] {
          t.Error("rewrite changed or omitted the native source map")
        }
        if !strings.HasPrefix(js, "\"use strict\";\n"+driver.RewriteSentinel+"\n") {
          t.Error("registered output omitted the actual header marker")
        } else {
          repeated, err := driverApplyRewrites(filepath.Join(projectRoot, "bin", source+".js"), js, rewrites, map[string]int{})
          if err != nil || repeated != js {
            t.Errorf("genuine already-rewritten output changed: err=%v\n%s", err, repeated)
          }
        }
        if source == "contexts" && (!strings.Contains(js, "// plugin.ns.make()") || !strings.Contains(js, "/* plugin.ns.make() */")) {
          t.Error("inert emitted call comments changed")
        }
        inputs = append(inputs, rewriteRuntimeInput{Name: mode+"/"+source, File: filepath.Join(root, mode, source+".js")})
      })
    }
  }
  _, diagnostics, err = program.EmitFile(rewrites, marker, func(shimtspath.RootedFilePath, string, *shimcompiler.WriteFileData) error {
    return fmt.Errorf("lexical writer failure")
  })
  writerFailure := false
  for _, diagnostic := range diagnostics {
    if strings.Contains(diagnostic.Message, "lexical writer failure") {
      writerFailure = true
    }
  }
  if err != nil || !writerFailure {
    t.Errorf("writer error was not reported as emit diagnostic: diagnostics=%#v err=%v", diagnostics, err)
  }

  expected := map[string]map[string]string{
    "marker": {"marker": driver.RewriteSentinel, "value": "marker-replaced"},
    "contexts": {"quoted": "plugin.ns.make()", "templateText": "plugin.ns.make()", "regexText": "plugin.ns.make()", "receiver": "original", "adjacent": "adjacent", "first": "first", "templateExpression": "before plugin.ns.make() inside after", "nested": "outer:inner", "unicode": "unicode-replaced"},
  }
  if len(inputs) != 0 {
    results, nodeErr := runRewriteRuntimeBatch(root, inputs)
    for _, input := range inputs {
      t.Run(input.Name+"/runtime", func(t *testing.T) {
        if nodeErr != nil {
          t.Fatal(nodeErr)
        }
        result := results[input.Name]
        if result.Error != "" {
          t.Fatalf("JavaScript load: %s", result.Error)
        }
        _, source, _ := strings.Cut(input.Name, "/")
        if !reflect.DeepEqual(result.Value, expected[source]) {
          t.Fatalf("runtime exports = %#v, want %#v", result.Value, expected[source])
        }
      })
    }
  }
}
