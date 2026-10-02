package evidence

import (
	"testing"

	"github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies the benchmark Prisma scaffold is inactive before its references.
 *
 * `prisma/schema/main.prisma` is a real matched schema file but its generator
 * and datasource blocks materialize no `model` unit. The fixture reproduces
 * the legacy model-free scaffold and drives the real Prisma loader so a fake
 * empty inventory cannot make the test pass.
 *
 *  1. Match the legacy model-free scaffold path and contents.
 *  2. Apply a model claim with an unreadable Markdown reference behind it.
 *  3. Reuse that real model-free inventory in the whole graph with data-only TypeScript and H1-only Markdown.
 *  4. Add a TypeScript function or H2 independently and require its missing reference to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification A cold real Prisma schema load must be clean and activeGraphConfig must drop its zero-model claim. The same root/schema then runs graphRule.Check with all three artifact claims: zero selected hosts yields failed=false and no messages, while independently adding a TypeScript function or H2 produces failed=true and names its own missing reference root.
 * @evidence contracts/testing.md#independent-expectations The expectation (a matched file with no selected model leaves the claim inactive) is the claimIsInactive contract; the fixture is a model-free scaffold of two generators and a datasource, and its equality to any benchmark fixture is not checked.
 * @evidence contracts/testing.md#distinguishing-cases Model-free Prisma, a numeric TypeScript export and H1-only Markdown form the inactive whole graph. Separate function and H2 additions detect blanket suppression. The first-model whole-rule missing-reference contrast is owned by TestFirstSelectedPrismaModelActivatesCoverage. The legacy two-generator scaffold and the consumer's one-generator scaffold share zero selected models; their bytes are not claimed identical.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive(t *testing.T) {
	root := prismaBridgeRoot(t, map[string]string{
		"prisma/schema/main.prisma": emptyPrismaScaffold,
	})
	requireColdPrismaSchemaFixture(t, root, "prisma/schema/main.prisma", emptyPrismaScaffold)
	config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/**/*.prisma"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`)
	inventories, problems := loadPrismaInventories(root, config)
	if len(problems) != 0 {
		t.Fatalf("the benchmark Prisma scaffold must load cleanly: %v", problems)
	}
	active := activeGraphConfig(
		config,
		map[string]*artifactInventory{},
		inventories,
		map[string]*artifactInventory{},
	)
	if len(active.Claims) != 0 {
		t.Fatal("a matched Prisma scaffold with no selected model must be inactive")
	}
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
	} {
		t.Run(scenario.name, func(t *testing.T) {
			result := runIndexRuleAtSeverity(t, root, map[string]string{
				"src/claim.ts":              scenario.source,
				"docs/claim.md":             scenario.document,
				"prisma/schema/main.prisma": emptyPrismaScaffold,
			}, wholeConfig, rule.SeverityError)
			if result.failed != (scenario.missingRoot != "") {
				t.Errorf("unexpected failure state %v: %v", result.failed, result.messages)
			}
			if scenario.missingRoot == "" {
				assertNoProblems(t, result.messages)
			} else {
				assertProblemContains(t, result.messages, scenario.missingRoot)
			}
		})
	}
}
