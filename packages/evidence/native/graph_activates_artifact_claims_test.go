package evidence

import "testing"

/**
 * Verifies a healthy Markdown claim matching zero files is inactive.
 *
 * Markdown uses the same own-population gate as TypeScript and Prisma. The
 * missing Prisma root is deliberately placed behind the claim so silence also
 * proves reference loading did not start.
 *
 *  1. Match no Markdown file with the claim glob.
 *  2. Configure an unreadable Prisma reference root.
 *  3. Assert the healthy empty claim and its reference remain silent.
 */
func TestMarkdownClaimMatchingZeroFilesIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/index.ts": "export interface Index {}\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/absent/**/*.md"],
    "symbol":"h2",
    "reference":{
      "type":"prisma",
      "root":"missing-prisma",
      "files":["**/*.prisma"],
      "symbol":"model"
    }
  }]}`))
}

/**
 * Verifies a matched Markdown file without the selected heading is inactive.
 *
 * File matching alone does not create a claim host. An H1-only document under
 * an H2 claim has no selected own unit, so the unreadable reference behind it
 * must not be loaded or diagnosed.
 *
 *  1. Match one Markdown file containing an H1 but no H2.
 *  2. Select H2 claim hosts and configure an unreadable Prisma reference.
 *  3. Assert the healthy zero-selected claim remains silent.
 */
func TestMarkdownClaimWithoutItsSelectedHeadingIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/README.md": "# Overview\n",
    "src/index.ts":   "export interface Index {}\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/**/*.md"],
    "symbol":"h2",
    "reference":{
      "type":"prisma",
      "root":"missing-prisma",
      "files":["**/*.prisma"],
      "symbol":"model"
    }
  }]}`))
}

/**
 * Verifies the first selected Markdown heading activates its claim.
 *
 * The inactive twins above prove file matching alone is insufficient. Adding
 * one H2 host must restore the existing reference obligation without changing
 * the claim configuration.
 *
 *  1. Match one Markdown file containing the selected H2 host.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected heading activates missing-acknowledgement coverage.
 */
func TestFirstSelectedMarkdownHeadingActivatesCoverage(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/claim.md":     "## Contract\n",
    "docs/reference.md": "## Requirement\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/claim.md"],
    "symbol":"h2",
    "reference":{
      "type":"markdown",
      "files":["docs/reference.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement")
}

const emptyPrismaScaffold = `generator client {
  provider     = "prisma-client"
  output       = "../../src/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "sqlite"
}

generator markdown {
  provider = "prisma-markdown"
  output   = "../../../../docs/ERD.md"
}
`

/**
 * Verifies the benchmark Prisma scaffold is inactive before its references.
 *
 * `prisma/schema/main.prisma` is a real matched schema file but its generator
 * and datasource blocks materialize no `model` unit. The fixture reproduces
 * the benchmark scaffold exactly and drives the real Prisma loader so a fake
 * empty inventory cannot make the test pass.
 *
 *  1. Match the exact model-free benchmark scaffold path and contents.
 *  2. Apply a model claim with an unreadable Markdown reference behind it.
 *  3. Assert the real loader leaves the zero-model claim inactive and silent.
 */
func TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema/main.prisma": emptyPrismaScaffold,
  })
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
}

/**
 * Verifies the first selected Prisma model activates its claim.
 *
 * A generator-only scaffold is inactive, but adding one model must restore the
 * configured Markdown coverage obligation without any lint-config toggle.
 *
 *  1. Match one Prisma file containing a selected model.
 *  2. Apply the activation filter to the real loaded inventory.
 *  3. Assert the selected model keeps the claim active.
 */
func TestFirstSelectedPrismaModelActivatesCoverage(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema/model.prisma": "model target {\n  id String @id\n}\n",
  })
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/**/*.prisma"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  inventories, problems := loadPrismaInventories(root, config)
  if len(problems) != 0 {
    t.Fatalf("the Prisma model must load cleanly: %v", problems)
  }
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    inventories,
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("the first selected Prisma model must activate its claim")
  }
}

/**
 * Verifies a failed Prisma parse cannot make its claim inactive.
 *
 * A parser failure may have hidden every selected model, so a unitless failed
 * inventory is not evidence of a healthy empty population. Keeping the claim
 * active preserves the parser diagnostic loaded during activation.
 *
 *  1. Match one Prisma claim inventory marked as parse-failed.
 *  2. Apply the shared own-population activation gate.
 *  3. Assert the failed claim remains active for its direct diagnostic.
 */
func TestFailedPrismaClaimPopulationDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/main.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  address := config.Claims[0].Base.addressOf("prisma/schema/main.prisma")
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{
      address.Key: {
        Address:    address.Key,
        Path:       address.Display,
        Type:       artifactPrisma,
        LoadFailed: true,
      },
    },
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("a parse-failed Prisma claim must remain active for its loader diagnostic")
  }
}

/**
 * Verifies an unreadable Markdown root cannot become inactive.
 *
 * No files match when the root cannot be opened, but that absence is not a
 * healthy empty population. The claim remains active so the root problem
 * produced by the claim-side loader is reported, and the loader's own record of
 * the failed base is what activation reads to tell the two apart. Handing this
 * an empty map would test a state the loader cannot hand it.
 *
 *  1. Resolve a Markdown claim against a missing root.
 *  2. Record the population failure the claim-side loader records.
 *  3. Assert the unreadable claim remains active for diagnosis.
 */
func TestUnreadableMarkdownClaimRootDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"markdown",
    "root":"missing-docs",
    "files":["**/*.md"],
    "symbol":"h2",
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
  }]}`)
  markdown := map[string]*artifactInventory{}
  recordPopulationFailure(markdown, artifactMarkdown, config.Claims[0].Base)
  active := activeGraphConfig(
    config,
    markdown,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("an unreadable Markdown root must remain active for its loader diagnostic")
  }
}
