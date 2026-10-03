package driver_test

import (
  "strings"
  "testing"
)

// writeFileDataCase is one compiler-option setting and the WriteFileData the
// plugin emit lane must hand its WriteFile callback for the JavaScript output.
type writeFileDataCase struct {
  name string
  // options is spliced into the fixture tsconfig's `compilerOptions`.
  options string
  // wantTrailer is whether a `//# sourceMappingURL=` trailer is written at all,
  // which is what decides between a real offset and the emitter's -1 sentinel.
  wantTrailer bool
  // markLength is how many bytes `emitBOM` prepends AFTER the offset is taken,
  // and therefore how far the reported offset sits behind the trailer's
  // position in the written file. Zero without `emitBOM`.
  markLength int
}

// writeFileDataSource is the smallest module that still produces a mappable
// statement, so a source map has something to point at.
const writeFileDataSource = "export const value = 1;\n"

// sourceMappingURLComment is the trailer the reported offset points at.
const sourceMappingURLComment = "//# sourceMappingURL="

// The two artifacts this fixture can produce, by base name.
const (
  jsArtifactName  = "index.js"
  mapArtifactName = "index.js.map"
)

// TestEmitPluginTransformPopulatesWriteFileData verifies that the
// plugin-transform emit lane hands its WriteFile callback the same
// WriteFileData the pinned tsgo emitter hands its own.
//
// Calling `writeFile(fileName, text, nil)` from `writePluginEmitOutput` would
// leave an embedder that reads `WriteFileData.SourceMapUrlPos` to locate and
// rewrite the `//# sourceMappingURL=` trailer without re-scanning the text with
// nothing the moment a plugin transform joined the chain — and a `nil` would
// mean both "nothing to report" and "never populated", which is indistinguishable
// at the callback. `printSourceFile` records that offset from the printer's writer, so
// the hand-assembled lane records it in the same place: before `emitBOM`
// prepends its mark, exactly as the emitter does, so the plugin build agrees
// with the plain build of the same project rather than being independently
// "correct". The external source map keeps a nil, because the emitter writes it
// with `writeText(sourceMapFilePath, sourceMap, nil)`.
//
//  1. For each option set, materialize one project and compile it twice: once
//     through `EmitAllRaw` (plain tsgo emit) and once through
//     `EmitLinkedTransforms` (the hand-assembled plugin lane).
//  2. Assert the plugin lane's WriteFileData for `index.js` is present, that its
//     SourceMapUrlPos equals the plain lane's (the plain lane being the oracle),
//     and that Diagnostics is empty, BuildInfo is nil and SkippedDtsWrite is
//     unset on a clean build with no `.tsbuildinfo`.
//  3. Assert the reported offset addresses the trailer in the written text
//     (allowing for the mark taken after it), or is the -1 sentinel when no
//     trailer was written.
//  4. Assert the external map is still written with no WriteFileData at all.
// @evidence contracts/testing.md#behavioral-verification Runs actual raw and plugin emission for five map/BOM rows and asserts nonnil JS callback metadata, exact offset parity, empty diagnostics, unset build info/skip flag and correct trailer position or minus-one sentinel.
// @evidence contracts/testing.md#independent-expectations Literal trailer and minus-one sentinel plus independent BOM byte count establish metadata-text correspondence; raw native emitter separately owns compatibility of offset convention.
// @evidence contracts/testing.md#distinguishing-cases External/inline/no map and BOM with/without map distinguish absent metadata, sentinel corruption and premark offsets. External map callbacks must retain nil data when present.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit loads separate real Programs through its emitter helper, captures WriteFileData snapshots, closes Programs and uses no product executable.
func TestEmitPluginTransformPopulatesWriteFileData(t *testing.T) {
  cases := []writeFileDataCase{
    {
      name:        "external_source_map_reports_the_trailer_offset",
      options:     `"target": "es2020", "sourceMap": true`,
      wantTrailer: true,
    },
    {
      // The negative twin: with no map there is no trailer to point at, and the
      // emitter reports -1 rather than 0 — a zero would name the file's first
      // byte, which is a legal offset.
      name:        "no_map_options_report_the_no_trailer_sentinel",
      options:     `"target": "es2020"`,
      wantTrailer: false,
    },
    {
      name:        "inline_source_map_reports_the_trailer_offset",
      options:     `"target": "es2020", "inlineSourceMap": true`,
      wantTrailer: true,
    },
    {
      // The boundary the emitter itself sets: the offset is the writer's text
      // position, taken before the mark is prepended, so in the written file
      // the trailer sits `markLength` bytes later. Reproducing that is the
      // point; a lane that "fixed" it would disagree with the plain build.
      name:        "emit_bom_keeps_the_offset_on_the_pre_mark_text",
      options:     `"target": "es2020", "sourceMap": true, "emitBOM": true`,
      wantTrailer: true,
      markLength:  len(utf8BOM),
    },
    {
      // The mark cannot turn the sentinel into an offset either.
      name:        "emit_bom_without_a_map_reports_the_sentinel",
      options:     `"target": "es2020", "emitBOM": true`,
      wantTrailer: false,
      markLength:  len(utf8BOM),
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "bin",
    "strict": true,
    `+testCase.options+`
  },
  "files": ["index.ts"]
}
`)
      writeProjectFile(t, root, "index.ts", writeFileDataSource)

      plain := emitFixtureArtifacts(t, root, false)
      plugin := emitFixtureArtifacts(t, root, true)

      plainJS, ok := plain[jsArtifactName]
      if !ok {
        t.Fatalf("plain lane did not emit %s; got %v", jsArtifactName, sortedKeys(plain))
      }
      pluginJS, ok := plugin[jsArtifactName]
      if !ok {
        t.Fatalf("plugin lane did not emit %s; got %v", jsArtifactName, sortedKeys(plugin))
      }
      if plainJS.data == nil {
        t.Fatalf("plain lane passed no WriteFileData for %s; the oracle this case compares against is gone", jsArtifactName)
      }
      if pluginJS.data == nil {
        t.Fatalf("plugin lane passed no WriteFileData for %s; a consumer cannot tell that from having nothing to report", jsArtifactName)
      }

      if got, want := pluginJS.data.SourceMapUrlPos, plainJS.data.SourceMapUrlPos; got != want {
        t.Fatalf("plugin lane reported SourceMapUrlPos %d for %s, plain lane %d", got, jsArtifactName, want)
      }
      if len(pluginJS.data.Diagnostics) != 0 {
        t.Fatalf("plugin lane reported emit diagnostics for %s on a clean build: %#v", jsArtifactName, pluginJS.data.Diagnostics)
      }
      if len(plainJS.data.Diagnostics) != 0 {
        t.Fatalf("plain lane reported emit diagnostics for %s on a clean build: %#v", jsArtifactName, plainJS.data.Diagnostics)
      }
      if pluginJS.data.BuildInfo != nil {
        t.Fatalf("plugin lane reported BuildInfo for %s, which emits no .tsbuildinfo: %#v", jsArtifactName, pluginJS.data.BuildInfo)
      }
      if pluginJS.data.SkippedDtsWrite {
        t.Fatalf("plugin lane pre-set SkippedDtsWrite for %s; it is the callee's field to set", jsArtifactName)
      }

      assertSourceMapUrlPos(t, "plugin", pluginJS, testCase)
      assertSourceMapUrlPos(t, "plain", plainJS, testCase)

      // The emitter writes the external map with no data at all, so a caller
      // keying off a non-nil data to recognize the JavaScript output keeps
      // working on this lane.
      if mapArtifact, present := plugin[mapArtifactName]; present && mapArtifact.data != nil {
        t.Fatalf("plugin lane passed WriteFileData for %s; the emitter writes the map with none: %#v", mapArtifactName, mapArtifact.data)
      }
      if mapArtifact, present := plain[mapArtifactName]; present && mapArtifact.data != nil {
        t.Fatalf("plain lane passed WriteFileData for %s, so this expectation no longer matches the pinned emitter: %#v", mapArtifactName, mapArtifact.data)
      }
    })
  }
}

// assertSourceMapUrlPos checks one lane's reported offset against the text it
// was reported for: the -1 sentinel when the case writes no trailer, otherwise
// an offset that addresses the trailer once the bytes `emitBOM` prepended after
// the offset was taken are accounted for.
func assertSourceMapUrlPos(t *testing.T, lane string, artifact emittedArtifact, testCase writeFileDataCase) {
  t.Helper()
  pos := artifact.data.SourceMapUrlPos
  if !testCase.wantTrailer {
    if pos != -1 {
      t.Fatalf("%s lane reported SourceMapUrlPos %d for a build with no sourceMappingURL trailer; want the -1 sentinel", lane, pos)
    }
    if strings.Contains(artifact.text, sourceMappingURLComment) {
      t.Fatalf("%s lane emitted a sourceMappingURL trailer this option set must not produce:\n%q", lane, artifact.text)
    }
    return
  }
  if pos < 0 {
    t.Fatalf("%s lane reported SourceMapUrlPos %d for a build that writes a sourceMappingURL trailer", lane, pos)
  }
  start := pos + testCase.markLength
  if start > len(artifact.text) {
    t.Fatalf("%s lane reported SourceMapUrlPos %d, past the end of a %d-byte output", lane, pos, len(artifact.text))
  }
  if !strings.HasPrefix(artifact.text[start:], sourceMappingURLComment) {
    t.Fatalf("%s lane reported SourceMapUrlPos %d, which does not address %q in:\n%q", lane, pos, sourceMappingURLComment, artifact.text)
  }
}
