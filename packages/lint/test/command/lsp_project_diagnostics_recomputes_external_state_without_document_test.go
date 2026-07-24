package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

type externalStateProjectRule struct{}

func (externalStateProjectRule) Name() string {
  return "test/external-project-diagnostics"
}

func (externalStateProjectRule) Check(ctx *publicrule.ProjectContext) {
  var options struct {
    File    string `json:"file"`
    Swagger string `json:"swagger"`
  }
  if err := ctx.DecodeOptions(&options); err != nil {
    panic(err)
  }
  data, err := os.ReadFile(filepath.Join(
    ctx.Identity.PhysicalProjectRoot,
    options.File,
  ))
  if err != nil || string(data) != "valid\n" {
    ctx.Report("external project input is invalid")
  }
  swagger, err := os.ReadFile(filepath.Join(
    ctx.Identity.PhysicalProjectRoot,
    options.Swagger,
  ))
  if err == nil && string(swagger) != "valid\n" {
    ctx.Report("external Swagger input is invalid")
  }
}

// TestLSPProjectDiagnosticsRecomputesExternalStateWithoutDocument verifies the
// project-only verb is fresh, resident-equivalent, and independent of an open
// source URI.
//
// A declared data edit must retain the Program while each request receives a
// new Engine and ProjectRule cycle. The successful empty publication clears the
// previous failure at the config URI.
//
//  1. Compare a failing cold publication with the first resident publication.
//  2. Rewrite only the external file and classify it as external.
//  3. Recompute without a document URI and assert an empty replacement.
//  4. Create, change, and delete Swagger data with cold/resident equivalence.
func TestLSPProjectDiagnosticsRecomputesExternalStateWithoutDocument(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  external := filepath.Join(root, "docs", "spec.md")
  swagger := filepath.Join(root, "api", "openapi.json")
  writeFile(t, external, "invalid\n")
  name := "test/external-project-diagnostics"
  previous, existed := registeredProjectRules[name]
  registeredProjectRules[name] = projectRuleAdapter{
    inner:          externalStateProjectRule{},
    name:           name,
    acceptsOptions: true,
  }
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[name] = previous
    } else {
      delete(registeredProjectRules, name)
    }
  })
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      name: []any{
        "error",
        map[string]any{
          "file":    "docs/spec.md",
          "swagger": "api/openapi.json",
        },
      },
    },
  })
  opts := &lspCommandOptions{
    cwd:         root,
    tsconfig:    filepath.Join(root, "tsconfig.json"),
    pluginsJSON: lintManifest(t),
  }

  cold, code := computeLSPProjectDiagnostics(opts)
  if code != 0 || cold == nil || len(cold.Diagnostics) != 1 {
    t.Fatalf("cold project diagnostics: code=%d publication=%#v", code, cold)
  }
  residentPrograms = newResidentProgramCache()
  t.Cleanup(func() {
    residentPrograms.invalidate()
    residentPrograms = nil
  })
  resident, code := computeLSPProjectDiagnostics(opts)
  if code != 0 || !reflect.DeepEqual(resident, cold) {
    coldJSON, _ := json.Marshal(cold)
    residentJSON, _ := json.Marshal(resident)
    t.Fatalf(
      "resident diagnostics differ from cold: code=%d\ncold=%s\nresident=%s",
      code,
      coldJSON,
      residentJSON,
    )
  }

  writeFile(t, external, "valid\n")
  residentPrograms.applyChanges(
    []string{external},
    map[string]struct{}{
      canonicalProjectPath("", realProjectPath(external)): {},
    },
  )
  cleared, code := computeLSPProjectDiagnostics(opts)
  if code != 0 || cleared == nil || len(cleared.Diagnostics) != 0 {
    t.Fatalf(
      "fresh project diagnostics: code=%d publication=%#v",
      code,
      cleared,
    )
  }
  if cleared.URI != cold.URI || cleared.URI == "" {
    t.Fatalf("clearing URI = %q, want %q", cleared.URI, cold.URI)
  }

  assertResidentMatchesCold := func(label string, want int) {
    t.Helper()
    resident, code := computeLSPProjectDiagnostics(opts)
    if code != 0 || resident == nil || len(resident.Diagnostics) != want {
      t.Fatalf(
        "%s resident diagnostics: code=%d publication=%#v",
        label,
        code,
        resident,
      )
    }
    cache := residentPrograms
    residentPrograms = nil
    cold, coldCode := computeLSPProjectDiagnostics(opts)
    residentPrograms = cache
    if coldCode != 0 || !reflect.DeepEqual(cold, resident) {
      t.Fatalf(
        "%s cold/resident mismatch: cold=%#v resident=%#v",
        label,
        cold,
        resident,
      )
    }
  }
  applyExternal := func() {
    residentPrograms.applyChanges(
      []string{swagger},
      map[string]struct{}{
        canonicalProjectPath("", realProjectPath(swagger)): {},
      },
    )
  }

  writeFile(t, swagger, "invalid\n")
  applyExternal()
  assertResidentMatchesCold("created Swagger", 1)
  writeFile(t, swagger, "valid\n")
  applyExternal()
  assertResidentMatchesCold("changed Swagger", 0)
  if err := os.Remove(swagger); err != nil {
    t.Fatal(err)
  }
  applyExternal()
  assertResidentMatchesCold("deleted Swagger", 0)
}
