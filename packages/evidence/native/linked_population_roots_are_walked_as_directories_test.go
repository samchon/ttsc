package evidence

import (
  "os"
  "path/filepath"
  "runtime"
  "strings"
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
  if countProblemsContaining(messages, "/target/") != 0 {
    t.Fatalf(
      "a document behind a link is named through the root, not through the link's own target",
    )
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
 * Verifies a base whose display already ends in a separator composes one.
 *
 * A drive root is the one directory whose separator is part of it, and a base on
 * another Windows volume has no relative spelling, so its display is that
 * absolute path. Concatenating blindly printed `D://requirements`, in every file
 * location as well as in the message a failed walk produces.
 *
 * The composition is asserted here from values rather than from a resolution,
 * because it is the branch that has to hold on every platform;
 * `TestALocationIsSpelledTheWayAReaderOpensIt` is where a configuration is shown
 * to produce such a display at all.
 *
 *  1. Compose a path under a base whose display ends in a separator.
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

/**
 * Verifies a link inside the population is still not followed.
 *
 * The negative twin of the repair, and the property it could most easily
 * overrun. Only the base moves: `filepath.WalkDir` does not descend into a link
 * it meets during the walk, and a population that silently absorbed one would
 * take in documents no glob under the declared root reaches and hand them
 * addresses through a directory that is not the base.
 *
 *  1. Put one document under the root and one behind a link inside it.
 *  2. Leave both uncited.
 *  3. Assert only the document under the root owes an acknowledgement.
 */
func TestALinkInsideThePopulationIsNotFollowed(t *testing.T) {
  workspace := t.TempDir()
  hidden := filepath.Join(workspace, "hidden")
  if err := os.MkdirAll(hidden, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(hidden, "secret.md"),
    []byte("## Secret {#secret}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  documents := filepath.Join(workspace, "documents")
  if err := os.MkdirAll(filepath.Join(documents, "requirements"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(documents, "requirements", "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(hidden, filepath.Join(documents, "requirements", "linked")); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
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
  if countProblemsContaining(messages, "secret") != 0 {
    t.Fatalf("a link met during the walk is not descended into")
  }
}

/**
 * Verifies a project whose own root is a link still reads its documents.
 *
 * The default base is the one every population takes without declaring a
 * `root`, so a checkout reached through a link, which is how a package manager
 * and several CI images lay one out, emptied every Markdown and Prisma
 * population in the project without a single diagnostic. The walk root is
 * resolved for this base as well, and its addresses stay bare project-relative
 * paths, which is what every citation written before roots existed depends on.
 *
 *  1. Put the whole project behind a link and point the rule at the link.
 *  2. Leave a selected section uncited.
 *  3. Assert the document is found and named by its plain project-relative path.
 */
func TestAProjectRootThatIsALinkStillReadsItsDocuments(t *testing.T) {
  workspace := t.TempDir()
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  link := filepath.Join(workspace, "project")
  if err := linkDirectory(real, link); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  messages := runIndexRuleAtRoot(t, link, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
    "src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'docs/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at docs/pricing.md:1")
}

/**
 * Verifies a link chain the resolver stops following is reported, not walked.
 *
 * The resolver gives up after a fixed number of hops and returns the link it
 * stopped on, while the stat that accepts the root follows further than that on
 * Linux and on Windows. A long enough chain therefore passed the gate and then
 * walked a link, which is exactly the silence following a link at all exists to
 * remove, reappearing past the bound. Nobody writes a chain this long; the class
 * is what has to be sealed.
 *
 * Darwin and the BSDs stop at the same number of hops the resolver does, so the
 * gate answers first there and this window does not exist. The case verifies
 * that rather than assuming it, because a chain the platform itself refuses to
 * follow proves nothing about the one the resolver refuses.
 *
 *  1. Build a chain of 35 links, past the 32 the resolver follows.
 *  2. Skip where the platform stops following at or before the same bound.
 *  3. Root a reference at its head, run the rule, and assert the root is named
 *     with no glob diagnostic derived from it.
 */
func TestALinkChainBeyondTheResolverIsReportedNotWalked(t *testing.T) {
  workspace := t.TempDir()
  target := filepath.Join(workspace, "target")
  if err := os.MkdirAll(filepath.Join(target, "requirements"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(target, "requirements", "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  previous := target
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  documents := filepath.Join(workspace, "documents")
  if err := linkDirectory(previous, documents); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  if _, err := os.Stat(documents); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so the root gate answers before the walk root can",
      err,
    )
  }
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
    "could not walk Markdown root '../documents': the root is a chain of links this rule stops following",
  )
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf(
      "a root the walk never reached is a failed population, not an empty one:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a root that is a link with no target asks to be replaced.
 *
 * `os.Stat` follows the link and reports the absent target, so the root reads as
 * missing and the repair is to create it. Something is already at that path, and
 * creating a directory over it fails, which is the unfollowable repair a file
 * occupying the path produces and the one this predicate exists to avoid.
 *
 *  1. Point a link at a directory and then remove the directory.
 *  2. Root a reference at the link and run the rule.
 *  3. Assert the diagnostic asks for a replacement rather than a creation.
 */
func TestARootLinkWithNoTargetAsksToBeReplaced(t *testing.T) {
  workspace := t.TempDir()
  target := filepath.Join(workspace, "target")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(target, filepath.Join(workspace, "documents")); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  if err := os.Remove(target); err != nil {
    t.Fatal(err)
  }
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
  assertProblemContains(t, messages, "because that path is not a directory")
  assertProblemContains(
    t,
    messages,
    "replace that path with a directory and the markdown sources it should hold",
  )
}

/**
 * Verifies a linked file inside the population is read like any other file.
 *
 * The twin of the directory case, and the reason the documentation cannot say
 * that links inside a population are simply not followed. `filepath.WalkDir`
 * hands a symbolic link to a file to the callback as an ordinary entry, the
 * globs match its name, and the read that follows resolves it. A reader told
 * otherwise would look for the missing acknowledgement somewhere else.
 *
 *  1. Put a document outside the population and link to it from inside.
 *  2. Leave it uncited.
 *  3. Assert the link's own path owes the acknowledgement.
 */
func TestALinkedFileInsideThePopulationIsRead(t *testing.T) {
  workspace := t.TempDir()
  documents := filepath.Join(workspace, "documents", "requirements")
  if err := os.MkdirAll(documents, 0o755); err != nil {
    t.Fatal(err)
  }
  outside := filepath.Join(workspace, "outside.md")
  if err := os.WriteFile(outside, []byte("## Discounts {#discounts}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(outside, filepath.Join(documents, "pricing.md")); err != nil {
    t.Skipf("this platform refused to link a file: %v", err)
  }
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
}

/**
 * Verifies a location is spelled the way a reader opens it, in every base shape.
 *
 * The guide promises this and had promised something narrower three times: that
 * a location stays project-relative, which two reachable roots deny. A root on
 * another Windows volume and a UNC share have no relative spelling from a
 * drive-letter project, so `filepath.Rel` refuses and the absolute path is what
 * a reader opens. Pinning the shapes is what keeps the sentence honest.
 *
 *  1. Resolve a root inside the project, one above it, one absolute on the same
 *     volume, one on another volume, a bare drive root, and a UNC share.
 *  2. Compose a location under each.
 *  3. Assert the first three are project-relative and the rest are not.
 */
func TestALocationIsSpelledTheWayAReaderOpensIt(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("a second volume and a UNC share are Windows path shapes")
  }
  project := `C:\home\me\project`
  for _, entry := range []struct {
    declared string
    expected string
  }{
    {"docs", "docs/requirements/pricing.md"},
    {"../documents", "../documents/requirements/pricing.md"},
    {"C:/contracts", "../../../contracts/requirements/pricing.md"},
    {"D:/contracts", "D:/contracts/requirements/pricing.md"},
    {"D:/", "D:/requirements/pricing.md"},
    {"//server/share", "//server/share/requirements/pricing.md"},
  } {
    base := resolvePopulationBase(project, entry.declared)
    if got := base.display("requirements/pricing.md"); got != entry.expected {
      t.Fatalf("root %q location = %q, want %q", entry.declared, got, entry.expected)
    }
    if base.Declared != entry.declared {
      t.Fatalf("root %q declared = %q", entry.declared, base.Declared)
    }
  }
}

/**
 * Verifies a TypeScript claim rooted at a link keeps its hosts.
 *
 * This kind walks nothing, so the link asymmetry was left out of the walker
 * repair on the grounds that it had no walk. It does have a comparison: the gate
 * accepts a linked root because `os.Stat` follows it, and the Program reports
 * whatever path its tsconfig resolved, so when the two disagree every source
 * fails the match, the claim selects nothing, and it deactivates without a word.
 * Measured before the repair: no diagnostic at all.
 *
 *  1. Link a directory onto the project and root a TypeScript claim at the link.
 *  2. Leave its reference's selected section uncited.
 *  3. Assert the claim is active by reading the acknowledgement it owes.
 */
func TestALinkedTypeScriptClaimRootKeepsItsHosts(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(project, filepath.Join(workspace, "mirror")); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../mirror",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'docs/pricing.md#discounts'",
  )
}
