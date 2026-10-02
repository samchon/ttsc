package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverSessionApplyPreservesSourcePreamble Verifies incremental updates
// read the overlay through the same preamble filesystem as the initial Program.
//
// Authored preamble and value-2 text ground exact expected contents.
//
// 1. Create a session with a source preamble and value 1.
// 2. Apply a value-2 edit and require content-only Program reuse.
// 3. Assert SourceText retains the preamble followed by edited source.
//
// @evidence contracts/testing.md#behavioral-verification NewSession and Apply reuse a content edit while SourceText keeps preamble plus edited text.
// @evidence contracts/testing.md#independent-expectations Authored preamble and value-2 text ground exact expected contents.
// @evidence contracts/testing.md#distinguishing-cases Value 1 changes to 2 with fixed project identity; project-shape rebuild is not covered.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverSessionApplyPreservesSourcePreamble is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestDriverSessionApplyPreservesSourcePreamble(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"strict":true,"noEmit":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  preamble := "declare const injected: number;\n"

  session, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit:    true,
    SourcePreamble: preamble,
  })
  if err != nil {
    t.Fatal(err)
  }
  if session == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  defer session.Close()

  file := filepath.Join(root, "index.ts")
  edited := "export const value = 2;\n"
  if reused := session.Apply(file, edited); !reused {
    t.Fatal("content-only preamble edit unexpectedly rebuilt the Program")
  }
  text, ok := session.SourceText(file)
  if !ok || text != preamble+edited {
    t.Fatalf("updated source lost its preamble: ok=%v text=%q", ok, text)
  }
}
