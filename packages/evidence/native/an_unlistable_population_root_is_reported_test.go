package evidence

import (
  "errors"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an unlistable base is named as a population rather than as an entry.
 *
 * A base the walk could not list costs every unit there is, so it is a finding
 * about the population and names the property that selected it. The per-entry
 * message beside it names a path a reader opens, and the two would be
 * indistinguishable if this one spelled a location too.
 *
 *  1. Compose the message for a declared root and for the default base.
 *  2. Read each one.
 *  3. Assert the declared spelling is used, and the project root where there is
 *     no declared spelling to use.
 */
func TestAnUnlistableBaseIsNamedAsAPopulation(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  cause := errors.New("permission denied")
  declared := unlistableBaseProblem(resolvePopulationBase(root, "../documents"), "Markdown", cause)
  want := "Evidence graph could not walk Markdown root '../documents': permission denied. " +
    "Make that root a directory this process can list, so its configured Markdown sources can be indexed."
  if declared != want {
    t.Fatalf("declared root:\n got %s\nwant %s", declared, want)
  }
  fallback := unlistableBaseProblem(resolvePopulationBase(root, ""), "Markdown", cause)
  wantFallback := "Evidence graph could not walk Markdown root '" + filepath.ToSlash(root) +
    "': permission denied. Make that root a directory this process can list, so its configured Markdown sources can be indexed."
  if fallback != wantFallback {
    t.Fatalf("default base:\n got %s\nwant %s", fallback, wantFallback)
  }
}

/**
 * Verifies an unlistable reference root is reported instead of being blamed on
 * the globs.
 *
 * The failure guard answered for entries inside the base, and answered for the
 * base itself only by accident: its base-relative path is `.`, which the glob
 * shape decides. Under this reference's `requirements/**` it is false, so the
 * one failure that empties the whole population was discarded, the population
 * reached evaluation healthy and empty, and the author was told their patterns
 * matched nothing.
 *
 *  1. Root a Markdown reference at a directory the process may not list.
 *  2. Run the rule.
 *  3. Assert the root is named and no glob diagnostic is derived from it.
 */
func TestAnUnlistableReferenceRootIsReportedAtItsCause(t *testing.T) {
  workspace := t.TempDir()
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
  unreadableDirectory(t, documents)
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
  assertProblemContains(t, messages, "could not walk Markdown root '../documents':")
  for _, derived := range []string{"matched no markdown files", "could not inspect"} {
    if countProblemsContaining(messages, derived) != 0 {
      t.Fatalf(
        "a base that could not be listed is reported once, at its cause:\n%s",
        strings.Join(messages, "\n"),
      )
    }
  }
}

/**
 * Verifies the report does not depend on the shape of the configured globs.
 *
 * `couldMatchDescendant(".")` is true for a pattern opening with `**` and false
 * for one opening with a segment, so before the repair an identical filesystem
 * state was reported under the first shape and swallowed under the second. The
 * base belongs to its population by construction, which is a fact about the
 * base and not about the patterns, so both selections have to answer alike.
 *
 *  1. Root one population with a leading `**` pattern and one with a segment.
 *  2. Make the root unlistable in both.
 *  3. Assert both name the root and neither derives a glob diagnostic.
 */
func TestAnUnlistableRootIsReportedWhateverTheGlobsSelect(t *testing.T) {
  for _, pattern := range []string{`"**/*.md"`, `"requirements/**/*.md"`} {
    workspace := t.TempDir()
    documents := filepath.Join(workspace, "documents")
    if err := os.MkdirAll(documents, 0o755); err != nil {
      t.Fatal(err)
    }
    unreadableDirectory(t, documents)
    messages := runRootedGraphIn(t, workspace, map[string]string{
      "project/src/sale.ts": "export interface ISale {}\n",
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{
        "type":"markdown",
        "root":"../documents",
        "files":[`+pattern+`],
        "symbol":"h2"
      }
    }]}`)
    assertProblemContains(t, messages, "could not walk Markdown root '../documents':")
    if countProblemsContaining(messages, "matched no markdown files") != 0 {
      t.Fatalf(
        "pattern %s derived a glob diagnostic from a failed population:\n%s",
        pattern,
        strings.Join(messages, "\n"),
      )
    }
  }
}

/**
 * Verifies an unlistable claim root does not deactivate the claim in silence.
 *
 * The claim side is the worse half. A reference at least prints something
 * misleading, while a claim whose population came back healthy and empty
 * deactivates without a word and takes its whole obligation with it, so the
 * build goes green over code nobody is answering for.
 *
 *  1. Root a Markdown claim at a directory the process may not list, selecting
 *     with a segment-leading glob, which is the shape that produced the silence.
 *  2. Run the rule.
 *  3. Assert the root is named rather than the claim vanishing.
 */
func TestAnUnlistableClaimRootDoesNotDeactivateInSilence(t *testing.T) {
  workspace := t.TempDir()
  documents := filepath.Join(workspace, "documents")
  if err := os.MkdirAll(documents, 0o755); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, documents)
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../documents",
    "files":["requirements/**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h3"}
  }]}`)
  assertProblemContains(t, messages, "could not walk Markdown root '../documents':")
}

/**
 * Verifies the Prisma walker answers an unlistable root the same way.
 *
 * Both walkers held the same guard and the same dead handler, so repairing one
 * would decide an identical filesystem state by artifact kind. The Prisma half
 * runs through its address collector, because the bridge below it needs a linked
 * feature suite this question does not depend on.
 *
 *  1. Root a Prisma population at a directory the process may not list.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the root is named once and the base is recorded failed.
 */
func TestAnUnlistablePrismaRootIsReportedAtItsCause(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  schema := filepath.Join(workspace, "schema")
  if err := os.MkdirAll(schema, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, schema)
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
  assertProblemContains(t, problems, "could not walk Prisma root '../schema':")
  if len(addresses) != 0 {
    t.Fatalf("a base that could not be listed selected %d addresses", len(addresses))
  }
  if len(failed) != 1 {
    t.Fatalf("a base that could not be listed is recorded failed, got %d", len(failed))
  }
}
