package driver_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramReadsRootFilesFromTheEnvironment pins the delivery channel for
// the root files the launcher hands a native host.
//
// A plugin sidecar is built from its author's Go source and parses its own
// flags, so a new flag would be fatal to every host that predates it. The
// launcher publishes the roots in `driver.RootFilesEnv` instead, and a host
// picks them up by calling LoadProgram. The four cases are the whole decision
// table: the environment applies, an explicit list wins over it, an absent
// variable changes nothing, and a malformed value is an error rather than a
// silent whole-project build.
//
//  1. Build a project whose `include` names `src`, beside scripts outside it.
//  2. Load it with a script in the environment, with an explicit conflicting
//     list, with nothing set, and with an unparsable value.
//  3. Assert the program's roots, or the error naming the channel.
func TestLoadProgramReadsRootFilesFromTheEnvironment(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", "export const value = 1;\n")
  writeProjectFile(t, root, "scripts/a.ts", "export const a = 1;\n")
  writeProjectFile(t, root, "scripts/b.ts", "export const b = 1;\n")
  a := tspath.NormalizePath(filepath.Join(root, "scripts", "a.ts"))
  b := tspath.NormalizePath(filepath.Join(root, "scripts", "b.ts"))
  inside := tspath.NormalizePath(filepath.Join(root, "src", "index.ts"))

  roots := func(t *testing.T, options driver.LoadProgramOptions) []string {
    t.Helper()
    prog, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
    if err != nil {
      t.Fatal(err)
    }
    if len(diags) != 0 {
      t.Fatalf("unexpected diagnostics: %#v", diags)
    }
    defer prog.Close()
    return prog.ParsedConfig.FileNames()
  }
  encoded := func(files ...string) string {
    payload, err := json.Marshal(files)
    if err != nil {
      t.Fatal(err)
    }
    return string(payload)
  }

  t.Run("environment value applies", func(t *testing.T) {
    t.Setenv(driver.RootFilesEnv, encoded(a))
    if got := roots(t, driver.LoadProgramOptions{}); len(got) != 1 || got[0] != a {
      t.Fatalf("roots = %#v, want the published script", got)
    }
  })

  t.Run("explicit list wins over the environment", func(t *testing.T) {
    t.Setenv(driver.RootFilesEnv, encoded(a))
    if got := roots(t, driver.LoadProgramOptions{RootFiles: []string{b}}); len(got) != 1 || got[0] != b {
      t.Fatalf("roots = %#v, want the explicit script", got)
    }
  })

  t.Run("absent variable keeps the config's list", func(t *testing.T) {
    t.Setenv(driver.RootFilesEnv, "")
    if got := roots(t, driver.LoadProgramOptions{}); len(got) != 1 || got[0] != inside {
      t.Fatalf("roots = %#v, want the config's own file", got)
    }
  })

  t.Run("malformed value is reported", func(t *testing.T) {
    t.Setenv(driver.RootFilesEnv, "{not json")
    _, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
    if err == nil {
      t.Fatal("a malformed payload was accepted silently")
    }
    if !strings.Contains(err.Error(), driver.RootFilesEnv) {
      t.Fatalf("error does not name the offending channel: %v", err)
    }
  })
}
