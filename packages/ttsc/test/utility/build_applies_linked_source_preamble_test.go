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

// TestUtilityBuildAppliesLinkedSourcePreamble verifies linked source-preamble
// plugins affect emitted JavaScript and declaration files during utility build.
//
// Declaration files may not carry the original parsed source text, so the
// utility host wraps tsgo's write callback and applies the preamble to
// every emitted file kind that the plugin targets.
//
// 1. Register a linked source-preamble plugin.
// 2. Run utility build with emit enabled and one manifest entry.
// 3. Assert the generated JavaScript and declaration file contain the preamble text.
//
// @evidence contracts/testing.md#behavioral-verification RunBuild with a linked source-preamble plugin writes both the JavaScript and the declaration output, and the assertions require the preamble text in each emitted file kind.
// The same build also runs a numeric emit hook and joins each external map's
// generated assignment or declaration name to the independently authored source
// coordinate 0:13. CommonJS maps the whole export assignment's start, while the
// declaration map retains the name token's position.
// @evidence contracts/testing.md#independent-expectations The expected preamble text is the literal string the test's own plugin injects, not text derived from the emitted files.
// @evidence contracts/testing.md#distinguishing-cases Declaration output is the neighbor that would miss the preamble if only the parsed-source path applied it; both file kinds are checked.
// @evidence contracts/testing.md#execution-ownership TestUtilityBuildAppliesLinkedSourcePreamble is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityBuildAppliesLinkedSourcePreamble(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Cleanup(resetLinkedPluginRegistry)
  driver.RegisterPlugin(utilityPreamblePlugin{})
  calls := 0
  driver.RegisterPlugin(utilityOrderedEmitPlugin{from: "1", to: "2", calls: &calls})
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "inlineSources": true,
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"pre","stage":"transform","config":{}},{"name":"emit","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunBuild mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(js), "utility linked preamble") {
    t.Fatalf("preamble missing from JavaScript:\n%s", js)
  }
  declaration, err := os.ReadFile(filepath.Join(root, "bin", "index.d.ts"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(declaration), "utility linked preamble") {
    t.Fatalf("preamble missing from declaration file:\n%s", declaration)
  }
  if calls != 1 || !strings.Contains(string(js), "exports.value = 2") {
    t.Fatalf("linked emit did not rewrite once: calls=%d js=%q", calls, js)
  }
  for _, artifact := range []string{"index.js", "index.d.ts"} {
    output, err := os.ReadFile(filepath.Join(root, "bin", artifact))
    if err != nil { t.Fatal(err) }
    mapBytes, err := os.ReadFile(filepath.Join(root, "bin", artifact + ".map"))
    if err != nil { t.Fatal(err) }
    var mapping utilitySourceMap
    if err := json.Unmarshal(mapBytes, &mapping); err != nil { t.Fatal(err) }
    found := false
    lines := strings.Split(string(output), "\n")
    for _, segment := range decodeSourceMapMappings(t, mapping.Mappings) {
      if segment.SourceLine == 0 && segment.SourceColumn == 13 {
        if segment.GeneratedLine < 0 || segment.GeneratedLine >= len(lines) ||
          segment.GeneratedColumn < 0 || segment.GeneratedColumn > len(lines[segment.GeneratedLine]) {
          continue
        }
        if artifact == "index.js" {
          if segment.GeneratedColumn == 0 && strings.TrimSuffix(lines[segment.GeneratedLine], "\r") == "exports.value = 2;" {
            found = true
          }
        } else if strings.HasPrefix(lines[segment.GeneratedLine][segment.GeneratedColumn:], "value") {
          found = true
        }
      }
    }
    if !found { t.Fatalf("%s has no generated assignment or declaration name mapped to authored value 0:13: %q", artifact, mapping.Mappings) }
  }
}
