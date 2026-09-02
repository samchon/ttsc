package driver_test

import (
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func TestTransformGraphPreservesFilePredicateForExtensionShapedPackageDirectory(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "allowJs": true, "module": "nodenext", "moduleResolution": "nodenext", "noImplicitAny": false, "target": "es2022" },
  "files": ["src/main.ts"]
}
`)
  writeProjectFile(t, root, "package.json", "{\"private\":true,\"type\":\"commonjs\"}\n")
  writeProjectFile(t, root, "src/main.ts", "import punycode from 'punycode';\nexport const value = punycode.version;\n")
  writeProjectFile(t, root, "node_modules/punycode/package.json", `{
  "name": "punycode",
  "version": "0.0.0",
  "main": "punycode.js"
}
`)
  writeProjectFile(t, root, "node_modules/punycode/punycode.js", "module.exports = { version: '0.0.0' };\n")
  writeProjectFile(t, root, "node_modules/punycode.js/package.json", `{
  "name": "punycode.js",
  "version": "0.0.0",
  "main": "punycode.js"
}
`)
  writeProjectFile(t, root, "node_modules/punycode.js/punycode.js", "module.exports = { version: 'other' };\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  graph := driver.NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil for a loaded program")
  }
  candidate := filepath.ToSlash(filepath.Join("node_modules", "punycode.js"))
  if !slices.Contains(graph.Candidates["src/main.ts"], candidate) {
    t.Fatalf("missing extension-shaped file candidate %q: %#v", candidate, graph.Candidates)
  }
  observation, ok := graph.InputObservations[candidate]
  if !ok {
    t.Fatalf("missing predicate observation for %q: %#v", candidate, graph.InputObservations)
  }
  if observation.FileExists == nil || *observation.FileExists {
    t.Fatalf("FileExists observation = %#v, want false", observation.FileExists)
  }
  if hash, found := graph.InputHashes[candidate]; !found || hash != nil {
    t.Fatalf("legacy candidate hash = %#v, %v; want explicit null", hash, found)
  }
  if realpath, found := graph.InputRealpaths[candidate]; !found || realpath != nil {
    t.Fatalf("legacy candidate realpath = %#v, %v; want explicit null", realpath, found)
  }
  if failure, found := graph.InputProofFailures[candidate]; found {
    t.Fatalf("stable speculative candidate failure = %q", failure)
  }
}
