package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityTransformMapsPrintedTextToItsSource verifies the transform
// envelope carries a source map from each changed file's printed text back to
// the text its author wrote, and none for a file printed unchanged
// (samchon/ttsc#1392).
//
// The utility host reprints every transformed file. A bundler handed that text
// without a map attributes every later position to the reprint: a Rollup build
// reports `SOURCEMAP_BROKEN`, and stack traces point at printed lines. The
// printer still sees each node's original position, so the host records a map
// while it prints. A linked source preamble is parsed as part of the file, so
// the host corrects the map to the authored text, including after a hashbang
// line, where the preamble does not start the file.
//
//  1. Transform a plain file and a hashbang file under a linked plugin that
//     inserts a preamble line, and assert each map carries the authored text
//     and maps `value` to its authored line and column.
//  2. Transform the plain file with no linked plugin, and assert it is printed
//     unchanged and carries no map.
func TestUtilityTransformMapsPrintedTextToItsSource(t *testing.T) {
  const source = "export const value = 1;\n"
  for name, authored := range map[string]string{
    "plain":    source,
    "hashbang": "#!/usr/bin/env node\n" + source,
  } {
    t.Run(name, func(t *testing.T) {
      resetLinkedPluginRegistry()
      driver.RegisterPlugin(utilityPreamblePlugin{input: filepath.Join(t.TempDir(), "banner.config.cjs")})
      result := runSourceMapTransform(t, authored, `[{"name":"pre","stage":"transform","config":{}}]`)
      assertAuthoredValueMapping(t, authored, result)
    })
  }

  t.Run("unchanged", func(t *testing.T) {
    resetLinkedPluginRegistry()
    result := runSourceMapTransform(t, source, `[]`)
    if result.TypeScript["index.ts"] != source {
      t.Fatalf("an unchanged file was printed differently: %q", result.TypeScript["index.ts"])
    }
    if len(result.SourceMaps) != 0 {
      t.Fatalf("an unchanged file carries a map: %#v", result.SourceMaps)
    }
  })
}

// runSourceMapTransform transforms a one-file project whose index.ts holds
// source, under the given linked plugin manifest.
func runSourceMapTransform(t *testing.T, source, plugins string) utilityTransformResult {
  t.Helper()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", source)
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", root, "--plugins-json", plugins})
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatal(err)
  }
  return result
}

// assertAuthoredValueMapping asserts index.ts's map carries source as its
// content and maps the printed `value` to its line and column in source.
func assertAuthoredValueMapping(t *testing.T, source string, result utilityTransformResult) {
  t.Helper()
  text := result.TypeScript["index.ts"]
  sourceMap, ok := result.SourceMaps["index.ts"]
  if !ok {
    t.Fatalf("changed file has no source map: %#v", result.SourceMaps)
  }
  if sourceMap.Version != 3 || sourceMap.File != "index.ts" || len(sourceMap.Sources) != 1 || sourceMap.Sources[0] != "index.ts" {
    t.Fatalf("source map header mismatch: %#v", sourceMap)
  }
  if len(sourceMap.SourcesContent) != 1 || sourceMap.SourcesContent[0] == nil || *sourceMap.SourcesContent[0] != source {
    t.Fatalf("source map does not carry the authored text: %#v", sourceMap.SourcesContent)
  }
  printed := strings.Split(text, "\n")
  generatedLine := -1
  for index, line := range printed {
    if strings.HasPrefix(line, "export const value") {
      generatedLine = index
    }
  }
  authored := strings.Split(source, "\n")
  sourceLine := -1
  for index, line := range authored {
    if strings.HasPrefix(line, "export const value") {
      sourceLine = index
    }
  }
  if generatedLine <= sourceLine {
    t.Fatalf("the preamble did not shift the declaration: %q", text)
  }
  generatedColumn := strings.Index(printed[generatedLine], "value")
  sourceColumn := strings.Index(authored[sourceLine], "value")
  for _, segment := range decodeSourceMapMappings(t, sourceMap.Mappings) {
    if segment.GeneratedLine == generatedLine && segment.GeneratedColumn == generatedColumn {
      if segment.Source != 0 || segment.SourceLine != sourceLine || segment.SourceColumn != sourceColumn {
        t.Fatalf("`value` maps to %#v, want line %d column %d", segment, sourceLine, sourceColumn)
      }
      return
    }
  }
  t.Fatalf("no mapping for `value` at %d:%d in %q", generatedLine, generatedColumn, sourceMap.Mappings)
}
