package driver_test

import (
  "bytes"
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDiagnosticsInsideASourcePreambleLoseOnlyTheirPosition verifies how a
// diagnostic that points into an injected source preamble is reported: the
// message survives, the coordinate does not.
//
// A source preamble is text the user never wrote, so a diagnostic landing inside
// it has no authored line to name — the one position the preamble correction
// cannot map back. The source-map lane drops such segments, but a diagnostic is
// not a mapping: dropping it would leave a failing build with nothing on stderr
// to explain the failure, and clamping it to the top of the file would print a
// coordinate that is simply false, which is the defect the correction exists to
// remove. So ttsc keeps the report and drops only the anchor, rendering it
// through the same `path: message` form it already uses for diagnostics with no
// source range, and still counting it as an error.
//
//  1. Load a project whose preamble carries an unresolvable import and whose own
//     source carries an ordinary type error, so one diagnostic falls inside the
//     injected region and its twin falls one byte-range outside it.
//  2. Assert the preamble diagnostic keeps its message, code, and file while
//     losing line, column, and offset, and that the authored diagnostic beside it
//     keeps a full authored anchor.
//  3. Assert the render places the authored error, reports the preamble error
//     through the anchor-less form, and never quotes the preamble text.
// @evidence contracts/testing.md#behavioral-verification Loads actual authored and injected errors and requires both survive, only injected coordinates disappear, authored coordinates remain exact, error count is two and rendering excludes injected text.
// @evidence contracts/testing.md#independent-expectations Literal unresolved import, authored bad marker, exact error count two and independent marker coordinates establish the expected attribution.
// @evidence contracts/testing.md#distinguishing-cases One injected missing import and one ordinary type error in the same Program distinguish coordinate suppression from diagnostic loss or overbroad stripping.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit uses in-process Program and diagnostics APIs with a private fixture and deferred close; rendered output stays in a local buffer.
func TestDiagnosticsInsideASourcePreambleLoseOnlyTheirPosition(t *testing.T) {
  const preamble = "import { missing } from \"./nowhere\";\n"
  const source = "export const bad: number = \"not a number\";\n"

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", source)

  prog, configDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit:    true,
    SourcePreamble: preamble,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(configDiags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", configDiags)
  }
  defer prog.Close()

  diags := prog.Diagnostics()
  if len(diags) != 2 {
    t.Fatalf("fixture must produce one preamble diagnostic and one authored diagnostic, got %d: %#v", len(diags), diags)
  }
  var unanchored, anchored *driver.Diagnostic
  for index := range diags {
    if diags[index].Line == 0 {
      unanchored = &diags[index]
    } else {
      anchored = &diags[index]
    }
  }
  if unanchored == nil || anchored == nil {
    t.Fatalf("expected exactly one anchor-less and one anchored diagnostic: %#v", diags)
  }

  if !strings.Contains(unanchored.Message, "Cannot find module") {
    t.Fatalf("the anchor-less diagnostic is not the preamble's unresolved import: %#v", *unanchored)
  }
  if !strings.HasSuffix(filepath.ToSlash(unanchored.File), "/index.ts") {
    t.Fatalf("preamble diagnostic lost its file name: %#v", *unanchored)
  }
  if unanchored.Code == 0 {
    t.Fatalf("preamble diagnostic lost its code: %#v", *unanchored)
  }
  if unanchored.Column != 0 || unanchored.Start != nil || unanchored.Length != nil {
    t.Fatalf("preamble diagnostic kept a position it has no authored counterpart for: %#v", *unanchored)
  }

  wantLine, wantColumn := lineAndColumnOfMarker(t, source, "bad")
  if anchored.Line != wantLine || anchored.Column != wantColumn {
    t.Fatalf("authored diagnostic reported at %d:%d, want %d:%d", anchored.Line, anchored.Column, wantLine, wantColumn)
  }
  if anchored.Start == nil || *anchored.Start != strings.Index(source, "bad") {
    t.Fatalf("authored diagnostic byte offset = %v, want %d", anchored.Start, strings.Index(source, "bad"))
  }

  // Both still fail the build: dropping the coordinate must not drop the error.
  if got := driver.CountErrors(diags); got != 2 {
    t.Fatalf("CountErrors = %d, want 2 (both diagnostics must fail the build)", got)
  }

  var out bytes.Buffer
  driver.WritePrettyDiagnostics(&out, diags, root)
  rendered := stripAnsiEscapes(out.String())
  anchor := fmt.Sprintf(":%d:%d - error", wantLine, wantColumn)
  if !strings.Contains(rendered, anchor) {
    t.Fatalf("pretty render does not place the authored diagnostic at %q:\n%s", anchor, rendered)
  }
  if !strings.Contains(rendered, "  - ") || !strings.Contains(rendered, unanchored.String()) {
    t.Fatalf("pretty render dropped the preamble diagnostic instead of reporting it without an anchor:\n%s", rendered)
  }
  if strings.Contains(rendered, "import { missing }") {
    t.Fatalf("pretty render quotes the injected preamble, which the user never wrote:\n%s", rendered)
  }
}
