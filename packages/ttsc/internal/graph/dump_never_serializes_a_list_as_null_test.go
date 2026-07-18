package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpNeverSerializesAListAsNull verifies every list the provenance contract
// declares reaches the wire as a list, even when the producer filled none of it.
//
// A nil Go slice encodes as `null`, and the TypeScript mirror types these as
// `string[]` / `T[]`, so a nil would fail validation at the consumer rather than
// here — and a consumer that did not validate would have to guess whether `null`
// meant "empty" or "absent". The distinction the contract actually uses for
// absence is `capabilities`, not the difference between `null` and `[]`, so the
// wire must never offer the second question.
//
//  1. Build a dump whose origin declares nothing at all.
//  2. Assert it still parses into lists, not nulls.
func TestDumpNeverSerializesAListAsNull(t *testing.T) {
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
