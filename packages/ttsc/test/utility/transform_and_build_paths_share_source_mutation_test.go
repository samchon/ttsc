package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
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
// Both runs use one shared plugin registration and one shared project tree, so
// the only variable is the pipeline.
func TestUtilityTransformAndBuildPathsShareSourceMutation(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(sharedMutationPlugin{})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  manifest := `[{"name":"shared","stage":"transform","config":{}}]`

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
  if !strings.Contains(ts, "__ttsc_injected_marker") {
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
}
