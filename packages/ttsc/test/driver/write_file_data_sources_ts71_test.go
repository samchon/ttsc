//go:build ttsc_typescript_7_1

package driver_test

import (
  "testing"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// assertWriteFileDataSources checks the WriteFileData each lane passes against
// the TypeScript 7.1 emitter: both artifacts name the source file they were
// emitted from, and the emitter writes the external map with that field
// alone, so the plugin lane must agree with the plain lane on both.
func assertWriteFileDataSources(t *testing.T, plain map[string]emittedArtifact, plugin map[string]emittedArtifact) {
  t.Helper()
  for lane, artifacts := range map[string]map[string]emittedArtifact{"plain": plain, "plugin": plugin} {
    js := artifacts[jsArtifactName]
    if js.data.SourceFile == nil || shimtspath.FileBaseName(js.data.SourceFile.FileName()) != "index.ts" {
      t.Fatalf("%s lane named no index.ts source for %s: %#v", lane, jsArtifactName, js.data.SourceFile)
    }
    mapArtifact, present := artifacts[mapArtifactName]
    if !present {
      continue
    }
    if mapArtifact.data == nil {
      t.Fatalf("%s lane passed no WriteFileData for %s; the pinned emitter names the source file", lane, mapArtifactName)
    }
    if mapArtifact.data.SourceFile != js.data.SourceFile {
      t.Fatalf("%s lane named a different source for %s than for %s", lane, mapArtifactName, jsArtifactName)
    }
    if mapArtifact.data.SourceMapUrlPos != 0 || mapArtifact.data.BuildInfo != nil || len(mapArtifact.data.Diagnostics) != 0 || mapArtifact.data.SkippedDtsWrite {
      t.Fatalf("%s lane populated more than SourceFile for %s: %#v", lane, mapArtifactName, mapArtifact.data)
    }
  }
}
