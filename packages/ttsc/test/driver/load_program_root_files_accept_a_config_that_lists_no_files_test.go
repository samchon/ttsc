package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramRootFilesAcceptAConfigThatListsNoFiles verifies the config
// diagnostics about its own file list do not stop a program built from other
// roots.
//
// A package can ship a tsconfig whose `include` matches nothing in the
// published tarball, and a config can list no files at all. TypeScript-Go
// reports TS18003 and TS18002 for those shapes, and both describe only the list
// the roots replace. Every other config diagnostic must still stop the load,
// and without roots the two must stay errors, or a broken project would build
// silently.
//
//  1. Build a config whose `include` matches nothing, and one whose `files` is
//     empty, each beside a root file.
//  2. Load each with and without the root, and load an invalid option with it.
//  3. Assert no load or Program diagnostics with the root, the matching code
//     without it, and the invalid option still reported.
func TestLoadProgramRootFilesAcceptAConfigThatListsNoFiles(t *testing.T) {
  cases := []struct {
    name   string
    config string
    code   int32
  }{
    {
      name:   "include matches nothing",
      config: `{ "compilerOptions": { "module": "commonjs" }, "include": ["src"] }`,
      code:   18003,
    },
    {
      name:   "files is empty",
      config: `{ "compilerOptions": { "module": "commonjs" }, "files": [] }`,
      code:   18002,
    },
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      root := t.TempDir()
      writeProjectFile(t, root, "tsconfig.json", c.config+"\n")
      writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

      prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
        RootFiles: []string{filepath.Join(root, "index.ts")},
      })
      if err != nil {
        t.Fatal(err)
      }
      if len(diags) != 0 {
        t.Fatalf("a diagnostic about the replaced list stopped the load: %#v", diags)
      }
      // The Program reports the config's parse errors again among its own, so
      // the replaced list must leave them as well.
      if diags := prog.Diagnostics(); len(diags) != 0 {
        t.Fatalf("the Program reported the replaced list: %#v", diags)
      }
      prog.Close()

      _, diags, err = driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
      if err != nil {
        t.Fatal(err)
      }
      if len(diags) != 1 || diags[0].Code != c.code {
        t.Fatalf("diagnostics without roots = %#v, want TS%d", diags, c.code)
      }
    })
  }

  t.Run("another config error still stops the load", func(t *testing.T) {
    root := t.TempDir()
    writeProjectFile(t, root, "tsconfig.json", `{ "compilerOptions": { "target": "not-a-target" }, "include": ["src"] }`+"\n")
    writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
    _, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
      RootFiles: []string{filepath.Join(root, "index.ts")},
    })
    if err != nil {
      t.Fatal(err)
    }
    if len(diags) == 0 {
      t.Fatal("an invalid option was dropped along with the file-list diagnostics")
    }
  })
}
