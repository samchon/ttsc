package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// writeLinkedDocuments builds a real directory and a link that names it, or
// skips when the platform refuses to create either.
//
// `linkDirectory` makes a symbolic link where the process may and a Windows
// junction otherwise, which is what pnpm installs for a workspace dependency
// there, so the case runs on every platform rather than pinning one.
func writeLinkedDocuments(t *testing.T, workspace string, files map[string]string) {
  t.Helper()
  target := filepath.Join(workspace, "target")
  for relative, content := range files {
    absolute := filepath.Join(target, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  if err := linkDirectory(target, filepath.Join(workspace, "documents")); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
}

/**
 * Verifies a population rooted at a link materializes the documents behind it.
 *
 * `baseDirectoryProblem` stats the root, which follows a link and finds a
 * directory, so the root is accepted. `filepath.WalkDir` lstats it, which does
 * not, so the walk descended into nothing and the population came back healthy
 * and empty over documents that were there. The two checks have to agree, and a
 * linked directory is the ordinary shape of a shared requirements set in a
 * workspace a package manager installed.
 *
 *  1. Put the documents behind a link and root a reference at the link.
 *  2. Cite one of its sections.
 *  3. Assert the graph closes.
 */
func TestALinkedMarkdownRootMaterializesItsDocuments(t *testing.T) {
  workspace := t.TempDir()
  writeLinkedDocuments(t, workspace, map[string]string{
    "requirements/pricing.md": "## Discounts {#discounts}\n",
  })
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies a document behind a link is named through the root the author
 * declared.
 *
 * The negative twin of the case above, and the property that decides how the
 * link is followed rather than whether. Walking the target and reporting its own
 * path would name a directory that appears nowhere in the configuration and
 * would move every citation target with it, which is the coupling a declared
 * root exists to remove.
 *
 *  1. Leave the selected section uncited behind the same link.
 *  2. Read the missing-acknowledgement diagnostic.
 *  3. Assert the target and the location are spelled through the declared root.
 */
func TestALinkedRootNamesItsDocumentsThroughTheDeclaredSpelling(t *testing.T) {
  workspace := t.TempDir()
  writeLinkedDocuments(t, workspace, map[string]string{
    "requirements/pricing.md": "## Discounts {#discounts}\n",
  })
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../documents/requirements/pricing.md:1")
  if countProblemsContaining(messages, "target") != 0 {
    t.Fatalf("a document behind a link is not named by its target directory")
  }
}

/**
 * Verifies a Markdown claim rooted at a link keeps its hosts.
 *
 * The claim side is the half that failed in silence. An empty healthy claim
 * deactivates without a word, so the obligation over every document behind the
 * link simply stopped existing, and no diagnostic anywhere said so.
 *
 *  1. Root a Markdown claim at the link, selecting documents that host nothing.
 *  2. Run the rule.
 *  3. Assert the claim is active by reading the acknowledgement it now owes.
 */
func TestALinkedClaimRootKeepsItsHosts(t *testing.T) {
  workspace := t.TempDir()
  writeLinkedDocuments(t, workspace, map[string]string{
    "requirements/pricing.md": "## Discounts {#discounts}\n",
  })
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/policy.md": "### Refunds {#refunds}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../documents",
    "files":["requirements/**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h3"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/policy.md#refunds'")
}

/**
 * Verifies the Prisma walker follows a linked root the same way.
 *
 * Both walkers lstat their root through the same call, so repairing one would
 * decide an identical filesystem state by artifact kind. The Prisma half runs
 * through its address collector, because the bridge below it needs a linked
 * feature suite this question does not depend on.
 *
 *  1. Put a schema behind a link and root a Prisma population at the link.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the schema is found and addressed through the declared root.
 */
func TestALinkedPrismaRootCollectsItsSchemas(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  writeLinkedDocuments(t, workspace, map[string]string{
    "models/user.prisma": "model User {\n  id Int @id\n}\n",
  })
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "root":"../documents",
      "files":["models/**/*.prisma"],
      "symbol":"model"
    }
  }]}`)
  addresses, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertNoProblems(t, problems)
  if len(failed) != 0 {
    t.Fatalf("a linked root that resolves is healthy, got %d failed", len(failed))
  }
  if len(addresses) != 1 {
    t.Fatalf("the schema behind the link is selected, got %d", len(addresses))
  }
  if addresses[0].Display != "../documents/models/user.prisma" {
    t.Fatalf("address = %q, want it spelled through the declared root", addresses[0].Display)
  }
}

/**
 * Verifies a base whose display is a drive root composes one separator.
 *
 * A base on another Windows volume has no relative spelling, so its display is
 * the absolute path, and a drive root carries its own separator. Concatenating
 * blindly printed `D://requirements`, in every file location as well as in the
 * message a failed walk produces.
 *
 *  1. Compose a path under a base whose display already ends in a separator.
 *  2. Compose one under an ordinary ascending base.
 *  3. Assert each carries exactly one separator at the join.
 */
func TestADriveRootBaseComposesOneSeparator(t *testing.T) {
  drive := populationBase{Absolute: `D:\`, Display: "D:/"}
  if got := drive.display("requirements/pricing.md"); got != "D:/requirements/pricing.md" {
    t.Fatalf("drive root display = %q", got)
  }
  ascending := populationBase{Absolute: `C:\docs`, Display: "../docs"}
  if got := ascending.display("requirements/pricing.md"); got != "../docs/requirements/pricing.md" {
    t.Fatalf("ascending display = %q", got)
  }
}
