package evidence

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies decoded Prisma activation preserves independent reference failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Uses actual TypeScript and Markdown scanners, activeGraphConfig and the Markdown/Prisma filesystem population loaders without the Prisma parser bridge. The original numeric-export/H1/empty decoded Prisma population drops all three claims. Independently selecting a function, H2 or first Prisma model retains exactly one claim and reports its own missing reference root at error severity.
 * @evidence contracts/testing.md#independent-expectations Zero selected healthy hosts owe no reference population; each single selected host activates its own reference. Expected active counts and missing root names are literal contract decisions, not results calculated through claimIsInactive. Prisma emptiness and the first model are authored decoded records, so this does not establish cold schema admission or the product host's failed flag.
 * @evidence contracts/testing.md#distinguishing-cases Preserves the scaffold case's three exact TypeScript/Markdown inputs and reference configuration, and the first-model case's exact selected model and rooted reference configuration. Actual missing directories distinguish reference failure from a healthy empty glob match. Hidden and failed own populations are covered by TestPrismaDecodedPopulationControlsActivation; parser admission and host reporting remain source/consumer responsibilities.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedActivationPreservesReferenceFailures is one selectable Go entry with four synchronous named cases. t.TempDir holds source/document fixtures for maintained native walkers, while in-process scanners and literal decoded Prisma units supply own populations. No Node child, built loader, installation, product host or artifact build is invoked. Original bridge entries remain until actual survivors execute.
 */
func TestPrismaDecodedActivationPreservesReferenceFailures(t *testing.T) {
  const wholeConfig = `{"claims":[
    {"type":"typescript","files":["src/**/*.ts"],"symbol":"function","reference":{"type":"markdown","root":"missing-typescript-docs","files":["**/*.md"],"symbol":"h2"}},
    {"type":"markdown","files":["docs/claim.md"],"symbol":"h2","reference":{"type":"prisma","root":"missing-markdown-prisma","files":["**/*.prisma"],"symbol":"model"}},
    {"type":"prisma","files":["prisma/schema/main.prisma"],"symbol":"model","reference":{"type":"markdown","root":"missing-prisma-docs","files":["**/*.md"],"symbol":"h2"}}
  ]}`
  for _, scenario := range []struct {
    name        string
    source      string
    document    string
    missingRoot string
  }{
    {"three-inactive-hosts", "export const value = 1;\n", "# Claim\n", ""},
    {"function-activates-reference", "export const value = 1;\nexport function selected(): void {}\n", "# Claim\n", "missing-typescript-docs"},
    {"heading-activates-reference", "export const value = 1;\n", "# Claim\n## Selected\n", "missing-markdown-prisma"},
    {"first-model-activates-reference", "export const value = 1;\n", "# Claim\n", "missing-prisma-docs"},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      root := t.TempDir()
      for path, content := range map[string]string{"src/claim.ts": scenario.source, "docs/claim.md": scenario.document} {
        absolute := filepath.Join(root, filepath.FromSlash(path))
        if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
          t.Fatal(err)
        }
      }
      raw := wholeConfig
      prismaPath := "prisma/schema/main.prisma"
      if scenario.name == "first-model-activates-reference" {
        raw = `{"claims":[{"type":"prisma","files":["prisma/schema/model.prisma"],"symbol":"model","reference":{"type":"markdown","root":"missing-prisma-docs","files":["**/*.md"],"symbol":"h2"}}]}`
        prismaPath = "prisma/schema/model.prisma"
      }
      config := decodeInventoryConfig(t, root, raw)
      resolveGraphSeverities(&config, rule.SeverityError)
      markdown, ownProblems := loadMarkdownInventories(root, claimPopulationConfig(config, artifactMarkdown))
      assertNoProblems(t, ownProblems)
      source := parseTypeScriptInventory(t, "src/claim.ts", scenario.source)
      typescript := map[string]*artifactInventory{"src/claim.ts": source}
      prisma := map[string]*artifactInventory{prismaPath: {Path: prismaPath, Type: artifactPrisma}}
      if scenario.name == "first-model-activates-reference" {
        prisma[prismaPath].Units = prismaModelUnits(prismaModel{Name: "target", Fields: []prismaField{{Name: "id", Symbol: "column"}}})
      }
      active := activeGraphConfig(config, markdown, prisma, typescript)
      expected := 0
      if scenario.missingRoot != "" {
        expected = 1
      }
      if len(active.Claims) != expected {
        t.Fatalf("expected %d active claim(s), got %d", expected, len(active.Claims))
      }
      _, markdownProblems := loadMarkdownInventories(root, active)
      _, _, prismaProblems := configuredPrismaAddressesWithHealth(active)
      problems := append(markdownProblems, prismaProblems...)
      if scenario.missingRoot == "" {
        assertNoProblems(t, problems)
        return
      }
      assertProblemContains(t, problems, scenario.missingRoot)
      errorFound := false
      for _, problem := range problems {
        if problem.Severity == rule.SeverityError {
          errorFound = true
        }
      }
      if !errorFound {
        t.Fatalf("the missing selected reference must produce an error: %v", problems)
      }
    })
  }
}
