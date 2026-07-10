package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverSessionApplyPreservesSourcePreamble verifies incremental updates
// read the overlay through the same preamble filesystem as the initial Program.
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
