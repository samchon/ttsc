package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestResponseFileReadsRemainCompilerGraphInputs verifies argument expansion
// keeps its observed files in universal graph proof on both compiler targets.
//
// Literal argv can stay unchanged while an argument file changes the Program.
//
//  1. Load nested response files from an argv directory distinct from cwd.
//  2. Compare their read hashes with independent SHA-256 over authored text.
//  3. Change strictness and require unchanged source diagnostics to change.
//
// @evidence contracts/testing.md#behavioral-verification Real LoadProgram uses nested response files at TsgoArgsCwd; NewTransformGraph exposes their original read hashes and native diagnostics change after only the nested file is edited.
// @evidence contracts/testing.md#independent-expectations SHA-256 over authored response text supplies hash expectations; assigning undefined to string requires TS2322 only under strictNullChecks, independently of graph metadata.
// @evidence contracts/testing.md#distinguishing-cases Nested and outer files, a distinct argv cwd, enabled and disabled strictness and unchanged source cover expansion and invalidation authority on both supported targets.
// @evidence contracts/testing.md#execution-ownership The driver Go runner discovers this direct compiler-API test; a private temporary project and each Program are owned by the test, with cleanup closing every acquired checker lease.
func TestResponseFileReadsRemainCompilerGraphInputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020"},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const value: string = undefined;\n")
  writeProjectFile(t, root, "args/main.rsp", "@nested.rsp\n")
  for _, strict := range []string{"--strict", "--strict false"} {
    arguments := strict + " --allowJs --declaration --resolveJsonModule --outDir ../generated --declarationDir ../declarations\n"
    writeProjectFile(t, root, "args/nested.rsp", arguments)
    program, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{TsgoArgs: []string{"@main.rsp"}, TsgoArgsCwd: filepath.Join(root, "args")})
    if err != nil || program == nil || len(diags) != 0 {
      t.Fatalf("response load: %v %#v", err, diags)
    }
    t.Cleanup(func() {
      if err := program.Close(); err != nil {
        t.Error(err)
      }
    })
    graph := driver.NewTransformGraph(program, root)
    for name, text := range map[string]string{"args/main.rsp": "@nested.rsp\n", "args/nested.rsp": arguments} {
      digest := sha256.Sum256([]byte(text))
      expected := hex.EncodeToString(digest[:])
      if graph.InputHashes[name] == nil || *graph.InputHashes[name] != expected {
        t.Fatalf("response-file read proof %s: %#v", name, graph.InputHashes[name])
      }
      found := false
      for _, input := range graph.ResolutionInputs {
        if input == name {
          found = true
        }
      }
      if !found {
        t.Fatalf("response file is not universal: %s", name)
      }
    }
    membership := graph.Membership
    if membership == nil || membership.OutDir == nil || membership.DeclarationDir == nil {
      t.Fatalf("missing effective root settings: %#v", membership)
    }
    if filepath.Clean(*membership.OutDir) != filepath.Join(root, "generated") || filepath.Clean(*membership.DeclarationDir) != filepath.Join(root, "declarations") {
      t.Fatalf("resolved output directories: %#v", membership)
    }
    suffixes := map[string]bool{}
    for _, extension := range membership.InputExtensions {
      suffixes[extension] = true
    }
    for _, extension := range []string{".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"} {
      if !suffixes[extension] {
        t.Fatalf("missing effective extension %s: %#v", extension, suffixes)
      }
    }
    errors := driver.CountErrors(program.Diagnostics())
    if (strict == "--strict" && errors == 0) || (strict != "--strict" && errors != 0) {
      t.Fatalf("strictness %s: %#v", strict, program.Diagnostics())
    }
    if err := program.Close(); err != nil {
      t.Fatal(err)
    }
  }
}
