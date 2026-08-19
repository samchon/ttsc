package evidence

import (
  "os"
  "os/exec"
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
    "found no directory at the end of the markdown root '../documents'",
  )
  assertProblemContains(t, messages, "a chain of links longer than this rule follows")
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
 * It sits with the linked-root cases because the root is the subject, not the
 * walk, and this file's name names the repair rather than the mechanism.
 *
 *  1. Link a directory onto the project and root a TypeScript claim at the link.
 *  2. Leave its reference's selected section uncited, and give the host a tag
 *     the rule reports by position.
 *  3. Assert the claim is active, and that the position names the declared root.
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
    "project/src/sale.ts":     "/** @evidence */\nexport interface ISale {}\n",
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
  // The target above belongs to the default Markdown base, so it would survive a
  // repair that composed the TypeScript address from the resolved directory. A
  // location naming the host file is the half that would not, which is why the
  // source carries a tag the rule has to report by position.
  assertProblemContains(t, messages, "../mirror/src/sale.ts")
}

/**
 * Verifies a linked base and the base it resolves onto stay two obligations.
 *
 * The negative twin of the TypeScript repair, and the risk it carries: accepting
 * a second spelling makes one source belong to two bases where it belonged to one.
 * That is what a declared root already means, and each base owns its own address
 * space, so the two claims have to report separately and neither may report the
 * other's unit. A repair that collapsed them would double one obligation and
 * silence the other.
 *
 *  1. Link a directory onto the project and root one claim at the link, leaving
 *     a second claim on the default base.
 *  2. Give each a reference over a different document.
 *  3. Assert exactly one acknowledgement per claim, each naming its own.
 */
func TestALinkedBaseAndTheBaseItResolvesOntoStayTwoObligations(t *testing.T) {
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
    "project/docs/policy.md":  "## Refunds {#refunds}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[
    {
      "type":"typescript",
      "root":"../mirror",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/pricing.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/policy.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 2 {
    t.Fatalf("two claims owe one acknowledgement each, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/pricing.md#discounts'")
  assertProblemContains(t, messages, "'docs/policy.md#refunds'")
  if countProblemsContaining(messages, "Claim 1 reference 1") != 1 {
    t.Fatalf("the linked claim reports once:\n%s", strings.Join(messages, "\n"))
  }
  if countProblemsContaining(messages, "Claim 2 reference 1") != 1 {
    t.Fatalf("the default claim reports once:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies a chain past the resolver is refused for the kind that walks nothing.
 *
 * The two walkers refuse it because the directory they were about to walk is
 * still a link. This kind has no walk, so its gate has to ask, and until it did
 * the population came back empty and the claim deactivated in silence, over the
 * same root a Markdown reference beside it reported.
 *
 *  1. Build a chain longer than the resolver follows onto the project.
 *  2. Root a TypeScript claim at its head and run the rule.
 *  3. Assert the root is refused rather than selecting nothing.
 */
func TestALinkChainBeyondTheResolverIsRefusedForTypeScriptToo(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  head := filepath.Join(workspace, "mirror")
  if err := linkDirectory(previous, head); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  if _, err := os.Stat(head); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
      err,
    )
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
    "found no directory at the end of the typescript root '../mirror'",
  )
}

/**
 * Verifies a Windows junction is read through, not only a symbolic link.
 *
 * `linkDirectory` prefers `os.Symlink` and falls back to `mklink /J` only where
 * the process lacks the privilege, so an elevated Windows runner would exercise
 * symbolic links on both lanes and leave the junction handling proven nowhere.
 * That handling is the whole reason `resolveLinkedDirectory` exists instead of
 * `filepath.EvalSymlinks`, which returns a junction unchanged.
 *
 *  1. Create the junction directly, without the symbolic-link preference.
 *  2. Root a Markdown reference at it.
 *  3. Assert its document materializes.
 */
func TestAWindowsJunctionRootIsReadThrough(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("a junction is a Windows reparse point")
  }
  workspace := t.TempDir()
  target := filepath.Join(workspace, "target", "requirements")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(target, "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  junction := exec.Command(
    "cmd", "/c", "mklink", "/J",
    filepath.FromSlash(filepath.Join(workspace, "documents")),
    filepath.FromSlash(filepath.Join(workspace, "target")),
  )
  if output, err := junction.CombinedOutput(); err != nil {
    t.Skipf("mklink refused: %v: %s", err, string(output))
  }
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
 * Verifies the project root itself is refused, and not told to correct a `root`.
 *
 * The default base is checked by the two walkers, and it is the one base that
 * declared no property, so the sentence written for a declared root would send
 * its author looking for a line their configuration does not contain. It is the
 * ttsc project root, so it is named as one and the repair is the invocation.
 *
 * The TypeScript gate deliberately does not ask this of the default base: a
 * Program spells its sources against the directory ttsc was invoked with, so the
 * comparison matches without any resolution and refusing would fail a population
 * that works. The refusal below therefore comes from the Markdown reference.
 *
 *  1. Build a chain longer than the resolver follows and drive the rule with it
 *     as the project root, which is a state the host's own realpath keeps
 *     production from reaching at this length.
 *  2. Read the refusal.
 *  3. Assert it names the project root and asks for the invocation, not the
 *     property.
 */
func TestAProjectRootPastTheResolverIsNotToldToCorrectARoot(t *testing.T) {
  workspace := t.TempDir()
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  if _, err := os.Stat(previous); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so nothing reaches the refusal",
      err,
    )
  }
  messages := runIndexRuleAtRoot(t, previous, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
    "src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "found no directory at the end of the ttsc project root")
  assertProblemContains(t, messages, "Run ttsc against the directory those links end at.")
  if countProblemsContaining(messages, "Correct the 'root' property") != 0 {
    t.Fatalf(
      "the base that declared no root has no property to correct:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies the Prisma walker refuses an unresolved chain with its own noun.
 *
 * The refusal is one sentence for every kind, and the kind appears in it, so a
 * wrong noun or a dropped arm reads as another kind's failure. Markdown and
 * TypeScript each have a case; without this one the Prisma arm could be handed
 * either and stay green.
 *
 *  1. Build a chain longer than the resolver follows.
 *  2. Root a Prisma population at its head and collect the addresses.
 *  3. Assert the refusal names the Prisma root and the base is recorded failed.
 */
func TestAPrismaRootPastTheResolverIsRefusedAsPrisma(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  real := filepath.Join(workspace, "real")
  for _, directory := range []string{root, real} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  models := filepath.Join(real, "models")
  if err := os.MkdirAll(models, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(models, "user.prisma"),
    []byte("model User {\n  id Int @id\n}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  head := filepath.Join(workspace, "schema")
  if err := linkDirectory(previous, head); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  if _, err := os.Stat(head); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
      err,
    )
  }
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "root":"../schema",
      "files":["models/**/*.prisma"],
      "symbol":"model"
    }
  }]}`)
  addresses, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertProblemContains(
    t,
    problems,
    "found no directory at the end of the prisma root '../schema'",
  )
  // A schema sits behind the chain, so the directory the links end at is not
  // empty. The count says the refusal is what produced zero rather than an
  // empty population; it cannot tell a refusal from a walk that declined to
  // descend a link, which is why the refusal itself is asserted above.
  if len(addresses) != 0 {
    t.Fatalf("a root the walk never reached selected %d addresses", len(addresses))
  }
  if len(failed) != 1 {
    t.Fatalf("a root the walk never reached is recorded failed, got %d", len(failed))
  }
}

/**
 * Verifies a TypeScript population on the default base is not refused for a
 * chain.
 *
 * The gate asks the resolver question of a declared root only. A Program spells
 * its sources against the directory ttsc was invoked with, so the comparison
 * matches without any resolution, and refusing there failed every claim on the
 * base nearly every project uses. Measured before the guard: one refusal and no
 * obligations, over a graph that otherwise reports the one it owes.
 *
 * The configuration declares no Markdown or Prisma population on purpose, so no
 * walker can produce the refusal and the assertion is about this gate alone.
 *
 *  1. Drive the rule with a project root that is a chain longer than the
 *     resolver follows. Both entry points realpath the root before the rule sees
 *     it, so production reaches this shape only through a chain the platform
 *     itself refuses; the case builds the state directly instead.
 *  2. Declare only TypeScript populations, so no walker can produce the refusal.
 *  3. Assert the real obligation is reported and no refusal is.
 */
func TestADefaultTypeScriptBaseIsNotRefusedForAChain(t *testing.T) {
  workspace := t.TempDir()
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  if _, err := os.Stat(previous); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so nothing reaches the gate",
      err,
    )
  }
  messages := runIndexRuleAtRoot(t, previous, map[string]string{
    "src/sale.ts": "export interface ISale {}\n",
    "src/spec.ts": "export interface ISpec {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/sale.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/spec.ts"],"symbol":"type"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'ISpec'")
  if countProblemsContaining(messages, "found no directory at the end of") != 0 {
    t.Fatalf(
      "the base a Program spells its sources against owes no resolution:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a TypeScript claim rooted inside a linked directory keeps its hosts.
 *
 * The link is on an ancestor of the declared root rather than on the root, which
 * `os.Lstat` of the leaf cannot see: it reports a directory, because traversal
 * through a link is transparent. Nothing resolved it, the Program spelled its
 * sources the other way, every comparison failed, and the claim deactivated
 * without a word. Measured before the repair: no diagnostic at all.
 *
 * This is the shape a package manager installs. The workspace dependency is the
 * link and the root an author declares is a directory inside it.
 *
 *  1. Link a directory onto the workspace and root a claim at a path inside it.
 *  2. Leave the reference's selected section uncited.
 *  3. Assert the claim is active and its host is named through the declared root.
 */
func TestATypeScriptClaimRootedInsideALinkKeepsItsHosts(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(workspace, filepath.Join(workspace, "mirror")); err != nil {
    t.Skipf("this platform refused to create a link: %v", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "/** @evidence */\nexport interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../mirror/project",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'docs/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "../mirror/project/src/sale.ts")
}

/**
 * Verifies a walker rooted inside a link is unchanged by the same repair.
 *
 * The two walkers were never affected: they generate every path they compare
 * from the base they were handed, so a linked ancestor is transparent to them in
 * the way the filesystem intends. The repair moves what the base resolves to, and
 * this is the negative twin that says their addressing did not move with it.
 *
 *  1. Root a Markdown reference at a path inside a linked directory.
 *  2. Leave its section uncited.
 *  3. Assert the location is spelled through the declared root, not the link's
 *     target.
 */
func TestAMarkdownRootInsideALinkIsUnchanged(t *testing.T) {
  workspace := t.TempDir()
  documents := filepath.Join(workspace, "documents", "requirements")
  if err := os.MkdirAll(documents, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(documents, "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(workspace, filepath.Join(workspace, "mirror")); err != nil {
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
      "root":"../mirror/documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../mirror/documents/requirements/pricing.md:1")
}

/**
 * Verifies a chain past the resolver is refused on an ancestor of the root too.
 *
 * The twin of the case above, one component further up, and the shape that
 * makes the refusal worth having: the declared root itself is an ordinary
 * directory, so every stat of it answers directory and the leaf tells nobody
 * that the path reaching it is still a link. The filesystem opens it anyway,
 * the Program spells its sources through the other side, and the claim
 * deactivates in silence — which is what #1269 recorded and what asking every
 * component, rather than only the last, is for.
 *
 *  1. Build a chain longer than the resolver follows onto the workspace.
 *  2. Root a TypeScript claim at a real directory inside the chain's head.
 *  3. Assert the root is refused rather than selecting nothing.
 */
func TestALinkChainAboveARootIsRefusedForTypeScriptToo(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := workspace
  head := ""
  for hop := range 34 {
    head = "hop" + decimal(hop)
    link := filepath.Join(workspace, head)
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  declared := "../" + head + "/project"
  if _, err := os.Stat(filepath.Join(workspace, head, "project")); err != nil {
    t.Skipf(
      "this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
      err,
    )
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"`+declared+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the end of the typescript root '"+declared+"'",
  )
  // The sentence was written for a chain at the root and reports one above it
  // too, so it says the path passes through a chain rather than that it is one.
  assertProblemContains(
    t,
    messages,
    "passes through a chain of links longer than this rule follows",
  )
}

/**
 * Verifies a path with no link in it resolves to the spelling it arrived as.
 *
 * The resolution walks components, and a volume is the one prefix that is not
 * one: a drive root and a UNC share carry their own separator, and a share root
 * has nothing after it at all. Recomposing such a base from the pieces the walk
 * starts with returns a path one character from the one it was given, which
 * names the same directory and compares as though it did not — so every
 * consumer that asks whether resolution moved the base would answer yes forever
 * on a base with no link in it, and pay the second spelling on every file.
 *
 * The names below are deliberately fictional. A shape this case can judge only
 * by its spelling has to be one no machine running it has made real, because a
 * link anywhere on such a path would change the answer correctly.
 *
 *  1. Take each volume and root shape this platform can spell.
 *  2. Resolve it with no link anywhere on the path.
 *  3. Assert the answer is the cleaned input, byte for byte.
 */
func TestAPathWithNoLinkResolvesToItsOwnSpelling(t *testing.T) {
  shapes := []string{}
  if runtime.GOOS == "windows" {
    shapes = append(
      shapes,
      `C:\`,
      `C:\ttsc-evidence-sales`,
      `C:\ttsc-evidence-sales\schema`,
      `\\ttsc-evidence-server\share`,
      `\\ttsc-evidence-server\share\sales`,
      `//ttsc-evidence-server/share`,
      `\\?\C:\ttsc-evidence-sales`,
    )
  } else {
    shapes = append(
      shapes,
      "/",
      "/ttsc-evidence-sales",
      "/ttsc-evidence-sales/schema",
    )
  }
  for _, shape := range shapes {
    resolved, ok := resolveLinkedPath(shape)
    if !ok {
      t.Fatalf("resolving '%s' must settle when no link is on it", shape)
    }
    if want := filepath.Clean(shape); resolved != want {
      t.Fatalf("resolving '%s' gave '%s'; want '%s'", shape, resolved, want)
    }
  }
}

/**
 * Verifies a real directory resolves to the directory it is.
 *
 * The case above judges spellings, which only a path nothing has made real can
 * be judged by. A directory that exists is the other half, and it is asked the
 * other question: an absent path ends every chain at its first `os.Lstat`,
 * while a present one walks the resolver's whole body at every component. What
 * it must answer is the same directory, not the same string — a platform whose
 * temporary directory sits behind a link of its own, as macOS's `/var` does,
 * changes the spelling for the very reason this resolution exists.
 *
 *  1. Take a real directory this platform allocated.
 *  2. Resolve it.
 *  3. Assert the answer is the same directory the filesystem knows.
 */
func TestARealDirectoryResolvesToTheDirectoryItIs(t *testing.T) {
  directory := t.TempDir()
  resolved, ok := resolveLinkedPath(directory)
  if !ok {
    t.Fatalf("resolving '%s' must settle", directory)
  }
  declared, err := os.Stat(directory)
  if err != nil {
    t.Fatal(err)
  }
  answered, err := os.Stat(resolved)
  if err != nil {
    t.Fatalf("resolving '%s' gave '%s', which does not open: %v", directory, resolved, err)
  }
  if !os.SameFile(declared, answered) {
    t.Fatalf("resolving '%s' gave '%s', which is another directory", directory, resolved)
  }
}

/**
 * Verifies a chain ending on the last hop this rule follows still resolves.
 *
 * The bound counts links followed, not answers given, and the difference is a
 * root that works. A chain whose last link lands on its directory exactly as
 * the last iteration is spent has resolved — the loop simply had none left to
 * look with — and the filesystem follows more than this on every platform. The
 * refusal beside this case is for a chain still going, and reporting one for
 * the other would take a population that loads and fail it. This is the
 * boundary between them, one hop below the case above.
 *
 *  1. Build a chain of exactly the length this rule follows.
 *  2. Root a TypeScript claim at its head and run the rule.
 *  3. Assert the population loads and owes its ordinary acknowledgement.
 */
func TestALinkChainEndingOnTheLastFollowedHopResolves(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  head := ""
  for hop := range 32 {
    head = "hop" + decimal(hop)
    link := filepath.Join(workspace, head)
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  declared := "../" + head
  if _, err := os.Stat(filepath.Join(workspace, head)); err != nil {
    t.Skipf("this platform does not follow a chain this long either (%v)", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"`+declared+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  for _, message := range messages {
    if strings.Contains(message, "found no directory at the end of") {
      t.Fatalf("a chain of exactly the followed length resolves:\n%s", strings.Join(messages, "\n"))
    }
  }
  // The population loaded, so the claim owes what any loaded population owes.
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/pricing.md#discounts'")
}

/**
 * Verifies the resolver follows exactly the number of links it claims to.
 *
 * The two graph cases either side of the boundary bracket it without pinning
 * it: raising the bound by one leaves both of them green, because the refusal
 * they assert is built well past either value. The bound is a single number
 * that decides whether a working root is refused, so it is measured directly
 * and at the two values that touch it.
 *
 *  1. Build one chain and take three lengths of it.
 *  2. Resolve each from its own head.
 *  3. Assert the last followed hop settles and the one after it does not.
 */
func TestTheResolverFollowsExactlyItsBoundOfLinks(t *testing.T) {
  workspace := t.TempDir()
  target := filepath.Join(workspace, "target")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  heads := []string{}
  previous := target
  for hop := range 33 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(previous, link); err != nil {
      t.Skipf("this platform refused to create a link: %v", err)
    }
    heads = append(heads, link)
    previous = link
  }
  // `hop[index]` is index+1 links above the directory, and the resolver's own
  // `os.Stat` walks the whole chain at once — so a platform that stops before
  // this one does answers the deepest case before the bound can.
  if _, err := os.Stat(heads[32]); err != nil {
    t.Skipf("this platform does not follow 33 links either (%v)", err)
  }
  for _, expected := range []struct {
    links   int
    settles bool
  }{
    {links: 31, settles: true},
    {links: 32, settles: true},
    {links: 33, settles: false},
  } {
    resolved, settled := resolveLinkedDirectory(heads[expected.links-1])
    if settled != expected.settles {
      t.Fatalf(
        "a chain of %d links settled=%v, want %v; resolved to '%s'",
        expected.links,
        settled,
        expected.settles,
        resolved,
      )
    }
    if !settled {
      continue
    }
    landed, err := os.Lstat(resolved)
    if err != nil || !landed.IsDir() {
      t.Fatalf("a chain of %d links settled on '%s', which is not a directory", expected.links, resolved)
    }
  }
}
