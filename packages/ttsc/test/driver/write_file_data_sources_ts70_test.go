//go:build !ttsc_typescript_7_1

package driver_test

import "testing"

// assertWriteFileDataSources checks the WriteFileData each lane passes with
// the external source map against the TypeScript 7.0 emitter, which writes the
// map with no data at all, so a caller keying off a non-nil data to recognize
// the JavaScript output keeps working on the plugin lane.
func assertWriteFileDataSources(t *testing.T, plain map[string]emittedArtifact, plugin map[string]emittedArtifact) {
  t.Helper()
  if mapArtifact, present := plugin[mapArtifactName]; present && mapArtifact.data != nil {
    t.Fatalf("plugin lane passed WriteFileData for %s; the emitter writes the map with none: %#v", mapArtifactName, mapArtifact.data)
  }
  if mapArtifact, present := plain[mapArtifactName]; present && mapArtifact.data != nil {
    t.Fatalf("plain lane passed WriteFileData for %s, so this expectation no longer matches the pinned emitter: %#v", mapArtifactName, mapArtifact.data)
  }
}
