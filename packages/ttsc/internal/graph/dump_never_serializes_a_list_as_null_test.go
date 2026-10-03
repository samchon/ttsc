package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpNeverSerializesAListAsNull checks that the five origin list fields
// decode as non-nil slices when the supplied origin is empty. It also rejects
// any :null token in this fixture's compact JSON; no consumer validator runs.
//
//  1. Build a dump whose origin declares nothing at all.
//  2. Assert it still parses into lists, not nulls.
//
// @evidence contracts/testing.md#behavioral-verification MarshalDump with empty DumpOrigin must emit no :null substring and decode non-nil capabilities, sources, universe configs, universe roots and diagnostics. This entry does not assert their lengths or validate other origin populations through a consumer.
// @evidence contracts/testing.md#independent-expectations The expectation is the wire rule that lists are never null: marshaling a dump built with an empty DumpOrigin must contain no ':null' substring and must decode with non-nil provenance.capabilities, sources, universe.configs, universe.roots and diagnostics. A nil Go slice encoding as null fails both checks.
// @evidence contracts/testing.md#distinguishing-cases Build a dump whose origin declares nothing at all; Assert it still parses into lists, not nulls.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes a native project, constructs and closes its compiler Program in-process, invokes Build, MarshalDump and SourceTexts, and decodes actual JSON with the standard library. A restored empty linked-plugin manifest excludes ambient hooks; no consumer installation or native product command runs.
func TestDumpNeverSerializesAListAsNull(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export const value = 1;\n")

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  // The emptiest origin a caller can pass: every list below is nil in Go.
  data, err := MarshalDump(Build(prog), root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{}, false)
  if err != nil {
    t.Fatal(err)
  }
  if strings.Contains(string(data), ":null") {
    t.Fatalf("dump serialized a null where a list belongs:\n%s", data)
  }

  var parsed struct {
    Provenance struct {
      Capabilities []string `json:"capabilities"`
      Sources      []any    `json:"sources"`
      Universe     struct {
        Configs []any `json:"configs"`
        Roots   []any `json:"roots"`
      } `json:"universe"`
    } `json:"provenance"`
    Diagnostics []any `json:"diagnostics"`
  }
  if err := json.Unmarshal(data, &parsed); err != nil {
    t.Fatal(err)
  }
  for name, list := range map[string]any{
    "provenance.capabilities":     parsed.Provenance.Capabilities,
    "provenance.sources":          parsed.Provenance.Sources,
    "provenance.universe.configs": parsed.Provenance.Universe.Configs,
    "provenance.universe.roots":   parsed.Provenance.Universe.Roots,
    "diagnostics":                 parsed.Diagnostics,
  } {
    switch typed := list.(type) {
    case []string:
      if typed == nil {
        t.Fatalf("%s came back nil, so it rode the wire as null", name)
      }
    case []any:
      if typed == nil {
        t.Fatalf("%s came back nil, so it rode the wire as null", name)
      }
    }
  }
}
