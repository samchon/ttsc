//go:build ttsc_typescript_7_1

package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestLSPMapperPermissionReachesDirectAndResidentLoads verifies the secondary
// compiler bootstrap honors inherited permission and explicit suppression.
// Only .ts inputs are selected, isolating authorization from mapper execution.
//
// 1. Load a valid project declaring an unused real protocol mapper.
// 2. Accept inherited permission and reject empty or withdrawn permission.
// 3. Reuse a resident Program, then invalidate it after response-file changes.
//
// @evidence contracts/testing.md#behavioral-verification The real upstream 7.1 config parser and direct/resident loader accept inherited permission, reject explicit empty and last-false assignments with TS18068, and re-evaluate a changed response before reuse.
// @evidence contracts/testing.md#independent-expectations Literal true/false arguments define authorization, TS18068 defines denial, and pointer identity defines unchanged reuse independently of the new argument fingerprint.
// @evidence contracts/testing.md#distinguishing-cases Covers inherited grant, explicit empty suppression, last-assignment withdrawal, unchanged resident reuse and a same-length response edit from true to a false assignment. A mapper-use marker must remain absent because no mapped extension is selected.
// @evidence contracts/testing.md#execution-ownership The tagged Go unit owns temporary config/response/package files and direct/resident Programs; restored environment channels select real upstream parsing. A marker checks that no mapper protocol method ran; this case does not certify external process startup/joins or an installed consumer.
func TestLSPMapperPermissionReachesDirectAndResidentLoads(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"noEmit":true,"target":"ESNext","module":"Preserve","moduleResolution":"bundler"},"contentMappers":[{"package":"unused-mapper","extensions":[".data"]}],"files":["main.ts"]}`)
  writeFile(t, filepath.Join(root, "main.ts"), "export const value = 1;\n")
  for _, name := range []string{"package.json", "mapper.cjs"} {
    text, err := os.ReadFile(filepath.Join("testdata", "unused-mapper", name))
    if err != nil {
      t.Fatal(err)
    }
    writeFile(t, filepath.Join(root, "node_modules", "unused-mapper", name), string(text))
  }
  t.Setenv(tsgoArgsEnv, `["--runExternalCode","true"]`)
  t.Setenv(tsgoArgsCwdEnv, root)
  granted, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{})
  if err != nil || len(diagnostics) != 0 || granted == nil {
    t.Fatalf("inherited grant: %v / %v", err, diagnostics)
  }
  granted.close()
  deny := func(options loadProgramOptions) {
    t.Helper()
    prog, diagnostics, err := loadProgram(root, "tsconfig.json", options)
    if prog != nil {
      prog.close()
      t.Fatal("denied mapper project created a Program")
    }
    var text strings.Builder
    shimdw.FormatASTDiagnosticsWithColorAndContext(&text, diagnostics, root)
    if err != nil || !strings.Contains(text.String(), "TS18068") {
      t.Fatalf("missing permission diagnostic: %v / %s", err, text.String())
    }
  }
  deny(loadProgramOptions{tsgoArgs: []string{}})
  t.Setenv(tsgoArgsEnv, `["--runExternalCode","true","--runExternalCode","false"]`)
  deny(loadProgramOptions{})
  writeFile(t, filepath.Join(root, "args.rsp"), "--runExternalCode true \n")
  t.Setenv(tsgoArgsEnv, `["@args.rsp"]`)
  cache := newResidentProgramCache()
  defer cache.invalidate()
  opts := &lspCommandOptions{cwd: root, tsconfig: "tsconfig.json"}
  first, diagnostics, _, err := cache.acquire(opts, false)
  if err != nil || len(diagnostics) != 0 || first == nil {
    t.Fatalf("resident grant: %v / %v", err, diagnostics)
  }
  again, _, _, err := cache.acquire(opts, false)
  if err != nil || again != first {
    t.Fatal("unchanged permission did not reuse its Program")
  }
  writeFile(t, filepath.Join(root, "args.rsp"), "--runExternalCode false\n")
  denied, diagnostics, _, err := cache.acquire(opts, false)
  if err != nil || denied != nil || len(diagnostics) == 0 || len(cache.entries) != 0 {
    t.Fatal("withdrawn response reused an authorized Program")
  }
  if _, err := os.Stat(filepath.Join(root, "node_modules", "unused-mapper", "mapper-used")); !os.IsNotExist(err) {
    t.Fatalf("unused mapper executed: %v", err)
  }
}
