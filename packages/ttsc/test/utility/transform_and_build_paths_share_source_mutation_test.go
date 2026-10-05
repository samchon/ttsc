package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// sharedMutationPlugin is a linked source-preamble plugin that injects a real
// runtime statement (not just a comment) ahead of the parsed project source.
// Because the injection happens before TypeScript-Go parses, the mutated text
// is part of every source file's AST and therefore must surface in BOTH the
// source-to-source transform output (as TypeScript) and the JavaScript build
// output (as emitted JS).
type sharedMutationPlugin struct{}

func (sharedMutationPlugin) SourcePreamble(driver.PluginContext) (string, error) {
  return "export const __ttsc_injected_marker = 7;\n", nil
}

// utilityOrderedEmitPlugin supplies one numeric rewrite to the linked emit lane.
// @evidence contracts/testing.md#behavioral-verification The fixture configures an ordered linked transform used by the utility build operation.
// @evidence contracts/testing.md#independent-expectations The test supplies literal before/after numeric tokens and a callback counter.
// @evidence contracts/testing.md#distinguishing-cases Two fixtures distinguish an omitted or reversed emit chain from the expected final value.
// @evidence contracts/testing.md#execution-ownership The fixture is registered in the Go test process; it acquires no external plugin or child process.
type utilityOrderedEmitPlugin struct {
  from string
  to string
  calls *int
}

// @evidence contracts/testing.md#behavioral-verification EmitTransform returns a visitor that replaces the configured numeric token and counts each source invocation.
// @evidence contracts/testing.md#independent-expectations Replacement text comes from the test-authored fixture fields.
// @evidence contracts/testing.md#distinguishing-cases Nonmatching nodes are visited unchanged; only the configured numeric literal is replaced.
// @evidence contracts/testing.md#execution-ownership The returned callback runs through the real in-process driver emit operation; it does not simulate a compiler or host transport.
func (plugin utilityOrderedEmitPlugin) EmitTransform(driver.PluginContext) (driver.PluginTransform, error) {
  return func(context *shimprinter.EmitContext, source *shimast.SourceFile) *shimast.SourceFile {
    (*plugin.calls)++
    var visitor *shimast.NodeVisitor
    visitor = context.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindNumericLiteral && node.Text() == plugin.from {
        return context.Factory.NewNumericLiteral(plugin.to, 0)
      }
      return visitor.VisitEachChild(node)
    })
    return visitor.VisitSourceFile(source)
  }, nil
}

// TestUtilityTransformAndBuildPathsShareSourceMutation pins the emit contract
// that a single plugin source mutation is reflected consistently across the two
// distinct host pipelines for the SAME project:
//
//   - transform (source-to-source): emits a JSON envelope of TypeScript text,
//     keyed by cwd-relative path.
//   - build (JS emit): writes lowered JavaScript to the outDir on disk.
//
// A divergence here -- the mutation showing up in one path but not the other --
// is exactly the class of regression this test catches. The plugin injects a
// concrete runtime declaration so the assertion is on real code, not a comment
// that could be stripped differently between the two paths.
//
// Both runs share the project and ordered registrations. The emit-only callbacks
// stay idle during source-to-source transformation and rewrite 1 to 100 to 200
// exactly once during build, even when the config lists the source twice.
//
// @evidence contracts/testing.md#behavioral-verification The linked preamble appears in transform and build output; the ordered emit callbacks stay idle during transform and rewrite the build value once despite duplicate source entries.
// @evidence contracts/testing.md#independent-expectations The injected declaration, unchanged source value 1, emitted value 200 and per-stage invocation counts 0/1 are authored literals.
// @evidence contracts/testing.md#distinguishing-cases Source-only transformation contrasts with emit; omitted or reversed linked stages cannot reach 200, and duplicate processing violates each stage's count of one.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformAndBuildPathsShareSourceMutation is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformAndBuildPathsShareSourceMutation(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  driver.RegisterPlugin(sharedMutationPlugin{})
  firstCalls, secondCalls := 0, 0
  driver.RegisterPlugin(utilityOrderedEmitPlugin{from: "1", to: "100", calls: &firstCalls})
  driver.RegisterPlugin(utilityOrderedEmitPlugin{from: "100", to: "200", calls: &secondCalls})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  manifest := `[{"name":"shared","stage":"transform","config":{}},{"name":"first","stage":"transform","config":{}},{"name":"second","stage":"transform","config":{}}]`

  // --- source-to-source path -------------------------------------------------
  tcode, tout, terr := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", manifest,
    })
  })
  if tcode != 0 || terr != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", tcode, tout, terr)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(tout)), &result); err != nil {
    t.Fatalf("transform output is not valid JSON envelope: %v\noutput=%q", err, tout)
  }
  ts, ok := result.TypeScript["index.ts"]
  if !ok {
    t.Fatalf("transform envelope missing cwd-relative key \"index.ts\": %#v", result.TypeScript)
  }
  if !strings.Contains(ts, "export const __ttsc_injected_marker = 7;") {
    t.Fatalf("source-to-source path dropped the injected mutation:\n%s", ts)
  }
  // The transform path is source-to-source: it must still be TypeScript-shaped
  // (the original export preserved), not lowered to commonjs.
  if !strings.Contains(ts, "export const value") {
    t.Fatalf("transform path did not preserve TypeScript source shape:\n%s", ts)
  }
  if strings.Contains(ts, "exports.") {
    t.Fatalf("transform path was lowered to commonjs instead of staying source-to-source:\n%s", ts)
  }
  if !strings.Contains(ts, "export const value = 1;") || firstCalls != 0 || secondCalls != 0 {
    t.Fatalf("source-to-source path ran emit hooks: first=%d second=%d source=%q", firstCalls, secondCalls, ts)
  }

  // --- JS emit path ----------------------------------------------------------
  bcode, bout, berr := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", manifest,
    })
  })
  if bcode != 0 || berr != "" {
    t.Fatalf("RunBuild mismatch: code=%d stdout=%q stderr=%q", bcode, bout, berr)
  }
  jsBytes, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatalf("build path did not emit bin/index.js: %v", err)
  }
  js := string(jsBytes)
  if !strings.Contains(js, "__ttsc_injected_marker") {
    t.Fatalf("JS emit path dropped the injected mutation:\n%s", js)
  }
  // The build path is true JS emit: the injected export must be lowered to
  // commonjs, proving this is the emit pipeline rather than source passthrough.
  if !strings.Contains(js, "exports.__ttsc_injected_marker = 7") {
    t.Fatalf("JS emit path did not lower the injected mutation to commonjs:\n%s", js)
  }
  if !strings.Contains(js, "exports.value = 200") || strings.Contains(js, "exports.value = 100") || firstCalls != 1 || secondCalls != 1 {
    t.Fatalf("ordered emit hooks mismatch: first=%d second=%d source=%q", firstCalls, secondCalls, js)
  }
}
