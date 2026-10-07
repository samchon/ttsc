package ttsc_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// Build reports compiler errors without replacing noEmitOnError with an
// unconditional pre-emit rejection. Both root files, including the unimported
// root, remain subject to the same native emission policy and provenance.
// Check and transform still reject the erroneous project without output.
//
// @evidence contracts/testing.md#behavioral-verification Real utility build calls load and emit authored two-root projects across semantic and syntax diagnostics, default/true/false policy, an explicit forwarded override, analysis-only and invalid-option admission. Written JavaScript, declarations, maps and source provenance distinguish permitted emission from withholding; the same erroneous project remains rejected by check and transform.
// @evidence contracts/testing.md#independent-expectations TS2322, TS1109 and TS6046, status two, the authored unused-root export and exact artifact/source names determine expectations independently of returned output or the compiler option composer.
// @evidence contracts/testing.md#distinguishing-cases Default and false allow output while true withholds it; a forwarded false overrides configured true. An unimported root must emit alongside the entry, while noEmit, invalid compiler options, check and transform remain negative neighbors.
// @evidence contracts/testing.md#execution-ownership This Go owning unit invokes utility entrypoints in-process with captured streams and temporary projects. Each build owns and closes its actual Program; two additional check/transform calls use the semantic fixture. It launches no Node/compiler subprocess and its temporary owner removes artifacts after each case.
func TestUtilityBuildDiagnosticsPreserveEmitPolicy(t *testing.T) {
  for _, row := range []struct {
    name, source, policy, forwarded, diagnostic string
    writes, noEmit                              bool
  }{
    {name: "semantic-default", source: `export const value: number = "bad";`, diagnostic: "TS2322", writes: true},
    {name: "semantic-false", source: `export const value: number = "bad";`, policy: `,"noEmitOnError":false`, diagnostic: "TS2322", writes: true},
    {name: "semantic-true", source: `export const value: number = "bad";`, policy: `,"noEmitOnError":true`, diagnostic: "TS2322"},
    {name: "forwarded-false", source: `export const value: number = "bad";`, policy: `,"noEmitOnError":true`, forwarded: `["--noEmitOnError","false"]`, diagnostic: "TS2322", writes: true},
    {name: "syntax-false", source: `export const value = ;`, policy: `,"noEmitOnError":false`, diagnostic: "TS1109", writes: true},
    {name: "syntax-true", source: `export const value = ;`, policy: `,"noEmitOnError":true`, diagnostic: "TS1109"},
    {name: "analysis-only", source: `export const value: number = "bad";`, diagnostic: "TS2322", noEmit: true},
    {name: "invalid-option", source: `export const value = 1;`, policy: `,"module":"invalid-module"`, diagnostic: "TS6046"},
  } {
    t.Run(row.name, func(t *testing.T) {
      root := t.TempDir()
      config := `{"compilerOptions":{"target":"es2020","module":"commonjs","outDir":"lib","declaration":true,"declarationMap":true,"sourceMap":true` + row.policy + `},"files":["entry.ts","unused.ts"]}`
      writeProjectFile(t, root, "tsconfig.json", config)
      writeProjectFile(t, root, "entry.ts", row.source)
      writeProjectFile(t, root, "unused.ts", `export const unused = "independent-unused-root";`)
      proof := filepath.Join(root, "provenance.json")
      args := []string{"--cwd", root, "--emit-provenance-json", proof}
      if row.noEmit {
        args = append(args, "--noEmit")
      } else {
        args = append(args, "--emit")
      }
      if row.forwarded != "" {
        args = append(args, "--tsgo-args", row.forwarded)
      }
      var out, stderr bytes.Buffer
      code := utility.RunBuildWithIO(args, &out, &stderr)
      if code != 2 || !strings.Contains(stderr.String(), row.diagnostic) {
        t.Fatalf("diagnostic/status: code=%d stdout=%q stderr=%q", code, out.String(), stderr.String())
      }
      for _, name := range []string{"entry.js", "unused.js", "entry.d.ts", "unused.d.ts", "entry.js.map", "unused.js.map", "entry.d.ts.map", "unused.d.ts.map"} {
        body, err := os.ReadFile(filepath.Join(root, "lib", name))
        if row.writes {
          if err != nil || len(body) == 0 {
            t.Fatalf("missing %s: %v", name, err)
          }
        } else if !os.IsNotExist(err) {
          t.Fatalf("withheld output %s: %q, %v", name, body, err)
        }
      }
      if row.writes {
        body, err := os.ReadFile(filepath.Join(root, "lib", "unused.js"))
        if err != nil || !strings.Contains(string(body), "independent-unused-root") {
          t.Fatalf("unused root: %q, %v", body, err)
        }
        body, err = os.ReadFile(proof)
        if err != nil {
          t.Fatal(err)
        }
        var provenance map[string][]string
        if err := json.Unmarshal(body, &provenance); err != nil {
          t.Fatal(err)
        }
        for _, stem := range []string{"entry", "unused"} {
          owners := provenance[filepath.Join(root, "lib", stem+".js")]
          if len(owners) != 1 || filepath.Base(owners[0]) != stem+".ts" {
            t.Fatalf("%s ownership: %v, complete proof=%v", stem, owners, provenance)
          }
          authored, authoredErr := os.Stat(filepath.Join(root, stem+".ts"))
          observed, observedErr := os.Stat(owners[0])
          if authoredErr != nil || observedErr != nil || !os.SameFile(authored, observed) {
            t.Fatalf("%s source identity: authored=%v observed=%v", stem, authoredErr, observedErr)
          }
        }
      }
      if row.name == "semantic-default" {
        var checked, transformed bytes.Buffer
        var checkErrors, transformErrors bytes.Buffer
        if status := utility.RunCheckWithIO([]string{"--cwd", root}, &checked, &checkErrors); status != 2 || !strings.Contains(checkErrors.String(), "TS2322") {
          t.Fatalf("check rejection: %d/%q", status, checkErrors.String())
        }
        if status := utility.RunTransformWithIO([]string{"--cwd", root}, &transformed, &transformErrors); status != 2 || !strings.Contains(transformErrors.String(), "TS2322") {
          t.Fatalf("transform rejection: %d/%q", status, transformErrors.String())
        }
        var result utilityTransformResult
        if err := json.Unmarshal(transformed.Bytes(), &result); err != nil || len(result.TypeScript) != 0 {
          t.Fatalf("transform published erroneous project: %q, %v", transformed.String(), err)
        }
      }
      body, err := os.ReadFile(filepath.Join(root, "entry.ts"))
      if err != nil || string(body) != row.source {
        t.Fatalf("authored source changed: %q/%v", body, err)
      }
    })
  }
}
