//go:build ttsc_typescript_7_1

package driver_test

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramRefusesContentMappersWithoutRunExternalCode verifies that a
// project declaring content mappers keeps the compiler's own gate: without
// `--runExternalCode` the driver reports TS18068 and starts no mapper.
//
// 1. Load the content-mapper project without forwarded flags.
// 2. Require the TS18068 config diagnostic and no mapper log.
//
// @evidence contracts/testing.md#behavioral-verification Calls LoadProgram without `--runExternalCode` and requires a TS18068 diagnostic and an absent mapper.log.
// @evidence contracts/testing.md#independent-expectations TS18068 is the compiler's documented code for content mappers without the flag; the absent log follows from the fixture mapper writing one on its first request.
// @evidence contracts/testing.md#distinguishing-cases A driver that starts mappers by itself, or drops the compiler's gate, produces the log or omits TS18068.
// @evidence contracts/testing.md#execution-ownership The owning driver unit loads an in-process Program over a private temporary project and closes it when one is returned.
func TestLoadProgramRefusesContentMappersWithoutRunExternalCode(t *testing.T) {
  root := writeContentMapperProject(t)

  program, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: []string{}})
  if err != nil {
    t.Fatal(err)
  }
  if program != nil {
    defer program.Close()
    diags = append(diags, program.Diagnostics()...)
  }
  refused := false
  for _, diagnostic := range diags {
    if diagnostic.Code == 18068 {
      refused = true
    }
  }
  if !refused {
    t.Fatalf("expected TS18068 without --runExternalCode: %#v", diags)
  }
  if _, err := os.Stat(filepath.Join(root, "node_modules", "sql-mapper", "mapper.log")); !os.IsNotExist(err) {
    t.Fatalf("a mapper ran without --runExternalCode: %v", err)
  }
}
