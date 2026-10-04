package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramReadsForwardedTsgoArgsFromTheEnvironment Verifies native decoding and precedence
// of flags received through the environment by LoadProgram.
//
// A `--tsgo-args` CLI flag would extend a plugin protocol third-party hosts have
// already frozen: a host parsing with `flag.ContinueOnError` and no such flag
// gets a parse error before its build starts. The launcher therefore publishes
// the payload in `driver.TsgoArgsEnv`, and a host that never declared the flag
// picks the options up by calling LoadProgram. This unit exercises decoding, not launcher delivery.
//
// The four cases below cover precedence and decode failure, because each wrong answer
// is invisible without its twin: the env value must apply, an explicit argv
// must win over it, an absent variable must change nothing, and a malformed
// value must be an error rather than a silent no-op.
//
//  1. Build a project whose tsconfig leaves `strict` off and whose source only
//     type-checks that way.
//  2. Load it with the environment carrying `--strict`, with an explicit
//     conflicting argv, with nothing set, and with an unparsable value.
//  3. Assert the resolved options and diagnostics for each.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram resolves strictness and diagnostics from the environment unless explicit TsgoArgs wins, and reports a malformed environment payload.
// @evidence contracts/testing.md#independent-expectations The authored nullable access type-checks with strict off and fails with strict on; expected precedence comes from explicit embedder options over inherited flags.
// @evidence contracts/testing.md#distinguishing-cases Environment strict requires literal nullable-identifier diagnostic code 18047; conflicting explicit noImplicitAny, empty environment and malformed JSON retain their separate branches without pinning diagnostic text.
// @evidence contracts/testing.md#execution-ownership The Go test/driver unit uses t.Setenv and direct Program loads; it exercises native option decoding, not launcher-to-sidecar delivery.
func TestLoadProgramReadsForwardedTsgoArgsFromTheEnvironment(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "strict": false
  },
  "include": ["src"]
}
`)
  // Only a non-strict program accepts this: under `strictNullChecks` the
  // parameter is possibly null.
  writeProjectFile(t, root, "src/index.ts", "export const len = (x: string | null): number => x.length;\n")

  loadStrictness := func(t *testing.T, options driver.LoadProgramOptions) (bool, []driver.Diagnostic) {
    t.Helper()
    prog, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
    if err != nil {
      t.Fatal(err)
    }
    if len(diags) != 0 {
      return false, diags
    }
    defer prog.Close()
    return prog.ParsedConfig.ParsedConfig.CompilerOptions.Strict.IsTrue(), prog.Diagnostics()
  }

  encoded := func(args ...string) string {
    payload, err := json.Marshal(args)
    if err != nil {
      t.Fatal(err)
    }
    return string(payload)
  }

  t.Run("environment value applies", func(t *testing.T) {
    t.Setenv(driver.TsgoArgsEnv, encoded("--strict"))
    strict, diags := loadStrictness(t, driver.LoadProgramOptions{})
    if !strict {
      t.Fatal("forwarded --strict from the environment did not reach CompilerOptions")
    }
    if len(diags) == 0 {
      t.Fatal("expected the strict-null diagnostic the forwarded flag turns on")
    }
    foundNullable := false
    for _, diag := range diags {
      if diag.Code == 18047 {
        foundNullable = true
      }
    }
    if !foundNullable {
      t.Fatalf("expected TS18047 for x.length with nullable x, got %#v", diags)
    }
  })

  t.Run("explicit argv wins over the environment", func(t *testing.T) {
    // An embedder that decided the argv itself keeps deciding, so a variable an
    // ancestor ttsc process left behind cannot override a deliberate choice.
    t.Setenv(driver.TsgoArgsEnv, encoded("--strict"))
    strict, diags := loadStrictness(t, driver.LoadProgramOptions{TsgoArgs: []string{"--noImplicitAny"}})
    if strict {
      t.Fatal("environment overrode an explicit TsgoArgs value")
    }
    if len(diags) != 0 {
      t.Fatalf("unexpected diagnostics under the explicit argv: %#v", diags)
    }
  })

  t.Run("absent variable forwards nothing", func(t *testing.T) {
    t.Setenv(driver.TsgoArgsEnv, "")
    strict, diags := loadStrictness(t, driver.LoadProgramOptions{})
    if strict {
      t.Fatal("strict turned on with nothing forwarded")
    }
    if len(diags) != 0 {
      t.Fatalf("unexpected diagnostics with nothing forwarded: %#v", diags)
    }
  })

  t.Run("malformed value is reported", func(t *testing.T) {
    t.Setenv(driver.TsgoArgsEnv, "{not json")
    _, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
    if err == nil {
      t.Fatal("a malformed payload was accepted silently")
    }
    if !strings.Contains(err.Error(), driver.TsgoArgsEnv) {
      t.Fatalf("error does not name the offending channel: %v", err)
    }
  })
}
