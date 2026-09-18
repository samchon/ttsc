package driver_test

import (
  "bytes"
  "fmt"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// preambleDiagnosticCase is one project shape and the authored anchor the single
// diagnostic it produces must be reported at.
type preambleDiagnosticCase struct {
  name     string
  preamble string
  // index and declaration are the fixture's two source files; an empty
  // declaration leaves the project with index.ts alone.
  index       string
  declaration string
  // errorFile is the fixture file the diagnostic belongs to, and marker is the
  // authored token it anchors on. The expected line and column are derived from
  // the fixture text rather than hand-counted, so the expectation cannot drift
  // away from the fixture.
  errorFile string
  marker    string
}

// preambleDiagnosticSource carries exactly one type error, on its fifth line.
const preambleDiagnosticSource = `export interface IUser {
  id: string;
}

export const bad: number = "not a number";
`

// preambleDiagnosticDeclaration carries exactly one type error, on its second
// line. Declaration files are never preamble-injected, so it is the control for
// the file kind the correction must leave alone.
const preambleDiagnosticDeclaration = `export interface Named {
  name: Missing;
}
`

// TestDiagnosticsCorrectSourcePreambleLineShift verifies that a source preamble
// does not move the position a compiler diagnostic is reported at.
//
// `sourcePreambleFS` prepends a plugin's preamble before TypeScript-Go parses,
// so every position tsgo records — including every diagnostic's — is shifted
// down by the preamble's line count, while the file the user opens has no
// preamble. `@ttsc/banner` is the shipped plugin that does this, and the reported
// line could land past the end of the real file. The neighbouring source-map lane
// has corrected the identical shift for a long time; the diagnostic lane is where
// the same invariant was missing, which also defeated the duplicate filter in
// `CompilerDiagnostics.ts` (it compares positions, so a shifted report never matched its
// plugin-free twin and the user saw the same error twice at two positions).
//
//  1. Load each fixture with the preamble the case declares, so the program is
//     preamble-shifted exactly as a `SourcePreamblePlugin` project is.
//  2. Assert the single diagnostic's line, column, and byte offset are the
//     authored ones, derived from the fixture text.
//  3. Assert the pretty render places the same coordinate, quotes the authored
//     source, never quotes the preamble, and never names the shifted line.
func TestDiagnosticsCorrectSourcePreambleLineShift(t *testing.T) {
  const preambleTwoLines = "// preamble 1\n// preamble 2\n"
  const preambleSixLines = "// preamble 1\n// preamble 2\n// preamble 3\n// preamble 4\n// preamble 5\n// preamble 6\n"

  cases := []preambleDiagnosticCase{
    {
      name:      "no_preamble_is_unchanged",
      index:     preambleDiagnosticSource,
      errorFile: "index.ts",
      marker:    "bad",
    },
    {
      name:      "two_line_preamble_reports_the_authored_line",
      preamble:  preambleTwoLines,
      index:     preambleDiagnosticSource,
      errorFile: "index.ts",
      marker:    "bad",
    },
    {
      // Same fixture, taller preamble. If any residual offset tracked the
      // preamble's height this row would disagree with the one above.
      name:      "six_line_preamble_reports_the_authored_line",
      preamble:  preambleSixLines,
      index:     preambleDiagnosticSource,
      errorFile: "index.ts",
      marker:    "bad",
    },
    {
      // ApplySourcePreamble inserts after the hashbang line rather than before
      // it, so the injected region does not start at offset zero.
      name:      "hashbang_file_reports_the_authored_line",
      preamble:  preambleSixLines,
      index:     "#!/usr/bin/env node\n" + preambleDiagnosticSource,
      errorFile: "index.ts",
      marker:    "bad",
    },
    {
      // Declaration files are excluded from injection, so their diagnostics were
      // never shifted and must not be moved by the correction either.
      name:        "declaration_file_diagnostic_is_untouched",
      preamble:    preambleSixLines,
      index:       "export const ok: number = 1;\n",
      declaration: preambleDiagnosticDeclaration,
      errorFile:   "types.d.ts",
      marker:      "Missing",
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      root := t.TempDir()
      files := []string{"index.ts"}
      writeProjectFile(t, root, "index.ts", testCase.index)
      if testCase.declaration != "" {
        files = append(files, "types.d.ts")
        writeProjectFile(t, root, "types.d.ts", testCase.declaration)
      }
      writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true
  },
  "files": ["%s"]
}
`, strings.Join(files, `", "`)))

      authored := testCase.index
      if testCase.errorFile == "types.d.ts" {
        authored = testCase.declaration
      }
      wantLine, wantColumn := lineAndColumnOfMarker(t, authored, testCase.marker)
      wantStart := strings.Index(authored, testCase.marker)

      prog, configDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
        ForceNoEmit:    true,
        SourcePreamble: testCase.preamble,
      })
      if err != nil {
        t.Fatal(err)
      }
      if len(configDiags) != 0 {
        t.Fatalf("unexpected config diagnostics: %#v", configDiags)
      }
      defer prog.Close()

      diags := prog.Diagnostics()
      if len(diags) != 1 {
        t.Fatalf("fixture must produce exactly one diagnostic, got %d: %#v", len(diags), diags)
      }
      got := diags[0]
      if !strings.HasSuffix(filepath.ToSlash(got.File), "/"+testCase.errorFile) {
        t.Fatalf("diagnostic file = %q, want a path ending in %q", got.File, testCase.errorFile)
      }
      if got.Line != wantLine || got.Column != wantColumn {
        t.Fatalf("diagnostic reported at %d:%d, want the authored %d:%d (preamble shift not corrected)", got.Line, got.Column, wantLine, wantColumn)
      }
      if got.Start == nil || *got.Start != wantStart {
        t.Fatalf("diagnostic byte offset = %v, want the authored offset %d", got.Start, wantStart)
      }

      var out bytes.Buffer
      driver.WritePrettyDiagnostics(&out, diags, root)
      rendered := stripAnsiEscapes(out.String())
      anchor := fmt.Sprintf(":%d:%d - error", wantLine, wantColumn)
      if !strings.Contains(rendered, anchor) {
        t.Fatalf("pretty render does not place the diagnostic at %q:\n%s", anchor, rendered)
      }
      authoredLine := strings.Split(authored, "\n")[wantLine-1]
      if !strings.Contains(rendered, strings.TrimSpace(authoredLine)) {
        t.Fatalf("pretty render does not quote the authored line %q:\n%s", authoredLine, rendered)
      }
      if testCase.preamble == "" {
        return
      }
      if strings.Contains(rendered, "// preamble") {
        t.Fatalf("pretty render quotes the injected preamble, which the user never wrote:\n%s", rendered)
      }
      shifted := fmt.Sprintf(":%d:%d - error", wantLine+strings.Count(testCase.preamble, "\n"), wantColumn)
      if strings.Contains(rendered, shifted) {
        t.Fatalf("pretty render still names the preamble-shifted position %q:\n%s", shifted, rendered)
      }
    })
  }
}

// lineAndColumnOfMarker returns the 1-based line and column of marker inside
// text, which is how the fixture itself states the expected diagnostic anchor.
func lineAndColumnOfMarker(t *testing.T, text, marker string) (int, int) {
  t.Helper()
  index := strings.Index(text, marker)
  if index < 0 {
    t.Fatalf("fixture does not contain the marker %q:\n%s", marker, text)
  }
  return strings.Count(text[:index], "\n") + 1, index - (strings.LastIndex(text[:index], "\n") + 1) + 1
}

// ansiEscapePattern matches the SGR sequences the diagnostic renderer always
// writes, so assertions can be made against the plain text a user reads.
var ansiEscapePattern = regexp.MustCompile("\x1b\\[[0-9;]*m")

// stripAnsiEscapes removes color escapes from rendered diagnostic output.
func stripAnsiEscapes(text string) string {
  return ansiEscapePattern.ReplaceAllString(text, "")
}
