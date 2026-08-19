package evidence

import (
  "io/fs"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an absolute declared root is named in the diagnostic exactly as the
 * author wrote it.
 *
 * The base was resolved and then re-spelled project-relative, so an author who
 * declared `C:/contracts` was handed back an ascending path and told to correct
 * a 'root' property their configuration does not contain. Naming the base at all
 * exists to make a population repairable from the diagnostic alone, and a
 * spelling absent from the file being repaired defeats exactly that.
 *
 *  1. Declare a TypeScript claim rooted at an absolute directory that is absent.
 *  2. Read the root diagnostic.
 *  3. Assert it names the declared spelling and neither restates nor
 *     mis-explains a resolution that never happened.
 */
func TestAnAbsoluteRootIsNamedAsTheAuthorWroteIt(t *testing.T) {
  workspace := t.TempDir()
  contracts := filepath.ToSlash(filepath.Join(workspace, "contracts"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"`+contracts+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '"+contracts+"'. Correct the 'root' property",
  )
  for _, absent := range []string{
    "which resolves to",
    "it resolves against the ttsc project root",
  } {
    if countProblemsContaining(messages, absent) != 0 {
      t.Fatalf(
        "an absolute root landed on itself, so %q describes nothing:\n%s",
        absent,
        strings.Join(messages, "\n"),
      )
    }
  }
}

/**
 * Verifies a relative declared root still carries both spellings and the clause
 * that explains them.
 *
 * The negative twin of the case above, and the one the repair could most easily
 * overrun. A relative root is the form where the derived spelling is the
 * author's own and where the project root genuinely is composed into it, so
 * every clause the absolute case drops has to survive here.
 *
 *  1. Declare the same claim with an ascending relative root.
 *  2. Read the root diagnostic.
 *  3. Assert the resolved location and the resolution clause are both present.
 */
func TestARelativeRootKeepsItsResolvedLocationAndClause(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '../contracts', which resolves to '",
  )
  assertProblemContains(t, messages, "it resolves against the ttsc project root")
  assertProblemContains(
    t,
    messages,
    "add that directory and make its sources part of the tsconfig Program",
  )
  if countProblemsContaining(messages, "because that path is not a directory") != 0 {
    t.Fatalf(
      "nothing occupies a path that holds nothing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a root written with backslashes is named in one slash-separated
 * form.
 *
 * An author on Windows may write `..\contracts`, and the message asking them to
 * correct it sits beside file locations this rule always prints with slashes.
 * The normalization belongs to the decoder, which runs before a project identity
 * exists to resolve against; this pins the composition end to end, because
 * storing the declared spelling is what makes the decoder's output visible to a
 * reader at all.
 *
 *  1. Declare the root with backslashes.
 *  2. Read the root diagnostic.
 *  3. Assert it names the slash-separated spelling and carries no backslash.
 */
func TestARootWrittenWithBackslashesIsNamedWithSlashes(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"..\\contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "the typescript root '../contracts'")
  for _, message := range messages {
    if strings.Contains(message, "\\contracts") {
      t.Fatalf("a declared root is named with slashes, got:\n%s", message)
    }
  }
}

/**
 * Verifies a glob diagnostic under an absolute root names that root as written.
 *
 * `describePopulation` reaches every claim and reference glob message that has a
 * declared root, and it is the one an author reads most often, because it fires
 * whenever the root is fine and the patterns are not. A root spelled one way in
 * the message and another in the configuration turns a pattern question into a
 * hunt for a directory that is not missing.
 *
 *  1. Root a Markdown reference at an absolute directory that exists.
 *  2. Select with patterns no document under it matches.
 *  3. Assert the empty-match diagnostic names the declared spelling.
 */
func TestAGlobDiagnosticNamesAnAbsoluteRootAsWritten(t *testing.T) {
  workspace := t.TempDir()
  contracts := filepath.ToSlash(filepath.Join(workspace, "contracts"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "contracts/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":               "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+contracts+`",
      "files":["specs/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "matched no markdown files for ['specs/**'] under root '"+contracts+"'",
  )
}

/**
 * Verifies a path a non-directory occupies asks to be replaced rather than
 * added.
 *
 * The stat this predicate runs fails on three states, and only two of them are
 * repaired by creating the directory. Told to "add that directory" over a path a
 * file already holds, an author follows the instruction, watches it fail, and
 * reads the same sentence again — the repair has to name what is in the way.
 *
 *  1. Put a file where a TypeScript claim's root is declared.
 *  2. Read the root diagnostic.
 *  3. Assert it states what is there and asks for a replacement.
 */
func TestANonDirectoryAtATypeScriptRootAsksToBeReplaced(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "contracts":               "not a directory\n",
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../contracts",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "because that path is not a directory")
  assertProblemContains(
    t,
    messages,
    "replace that path with a directory and make its sources part of the tsconfig Program",
  )
}

/**
 * Verifies the walkers answer an occupied root the same way.
 *
 * Repairing one artifact kind and leaving the others is the branch asymmetry
 * #1236 existed to remove, and this clause was deferred once precisely because
 * every branch had to move together. Markdown reaches the same predicate through
 * a loader rather than a claim-side pass, so its repair clause is what proves
 * the split is by artifact kind and not by call site.
 *
 *  1. Put a file where a Markdown reference's root is declared.
 *  2. Read the root diagnostic.
 *  3. Assert the Markdown repair clause names a replacement and its own sources.
 */
func TestANonDirectoryAtAMarkdownRootAsksToBeReplaced(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "documents":           "not a directory\n",
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../documents', which resolves to '",
  )
  assertProblemContains(
    t,
    messages,
    "replace that path with a directory and the markdown sources it should hold",
  )
}

/**
 * Verifies the default base still names no configuration property.
 *
 * `root: "."` folds into the base every un-rooted population shares, and a
 * stored spelling must not resurrect that as a second base spelled its own way.
 * The two configurations therefore have to produce the same diagnostics, not
 * merely similar ones.
 *
 *  1. Resolve the omitted root and the two spellings that fold onto the project
 *     root, one of which the decoder reduces before this is ever reached.
 *  2. Assert each is the default base and carries no declared spelling.
 *  3. Run a claim with `root: "."` and one with no root, and compare the output.
 */
func TestTheDefaultBaseCarriesNoDeclaredSpelling(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  for _, declared := range []string{"", ".", "./"} {
    base := resolvePopulationBase(root, declared)
    if !base.Default || base.Declared != "" {
      t.Fatalf("root %q must resolve to the default base, got %+v", declared, base)
    }
    if label := populationRootLabel(base); label != filepath.ToSlash(root) {
      t.Fatalf("default label = %q, want the project root", label)
    }
  }
  files := map[string]string{"project/src/sale.ts": "export interface ISale {}\n"}
  reference := `"reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}`
  declared := runRootedGraph(t, files, `{"claims":[{"type":"typescript","root":".",`+
    `"files":["src/**/*.ts"],"symbol":"type",`+reference+`}]}`)
  omitted := runRootedGraph(t, files, `{"claims":[{"type":"typescript",`+
    `"files":["src/**/*.ts"],"symbol":"type",`+reference+`}]}`)
  if strings.Join(declared, "\n") != strings.Join(omitted, "\n") {
    t.Fatalf(
      "a root naming the project is the default base:\ndeclared:\n%s\nomitted:\n%s",
      strings.Join(declared, "\n"),
      strings.Join(omitted, "\n"),
    )
  }
}

/**
 * Verifies one directory declared two ways stays one base with a stated
 * spelling.
 *
 * Deduplication is by resolved path, so two declarations share a base and one of
 * the two spellings is what the loader-level root messages print. Which one has
 * to be decided rather than observed: a message that moves with configuration
 * order while claiming to name what the author wrote is worse than either
 * answer.
 *
 *  1. Declare one directory relatively and absolutely, in each order.
 *  2. Collect the configured bases.
 *  3. Assert one base survives, spelled the way the first declaration wrote it.
 */
func TestOneDirectoryDeclaredTwoWaysKeepsTheFirstSpelling(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  absolute := filepath.ToSlash(filepath.Join(workspace, "shared"))
  claimOf := func(declared string) claimSpec {
    return claimSpec{
      Type: artifactMarkdown,
      Root: declared,
      Base: resolvePopulationBase(root, declared),
    }
  }
  for _, order := range [][]string{
    {"../shared", absolute},
    {absolute, "../shared"},
  } {
    config := graphConfig{Claims: []claimSpec{claimOf(order[0]), claimOf(order[1])}}
    bases := configuredBases(config, artifactMarkdown)
    if len(bases) != 1 {
      t.Fatalf("one directory is one base, got %d for %v", len(bases), order)
    }
    if bases[0].Declared != order[0] {
      t.Fatalf(
        "the first declaration owns the spelling: got %q, want %q",
        bases[0].Declared,
        order[0],
      )
    }
  }
}

/**
 * Verifies an absolute root leaves every location exactly where a relative one
 * puts it.
 *
 * Only the name of the configuration property moved. A file's location is
 * derived from `Display`, which this change deliberately leaves alone, so the
 * repair must be invisible to a reader who is opening files rather than editing
 * configuration — and the two spellings now legitimately differ in one message.
 *
 *  1. Root a Markdown reference at an absolute directory holding one document.
 *  2. Leave its selected section uncited.
 *  3. Assert the location ascends project-relatively and the target does not.
 */
func TestAnAbsoluteRootLeavesFileLocationsProjectRelative(t *testing.T) {
  workspace := t.TempDir()
  docs := filepath.ToSlash(filepath.Join(workspace, "docs"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+docs+`",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../docs/requirements/pricing.md:1")
}

/**
 * Verifies a citation under an absolute root resolves through the root, not
 * through the project.
 *
 * The address space belongs to the base and nothing about naming the property
 * differently may reach it. Without this the previous case would pass under a
 * resolver that had quietly stopped loading the population at all, since a
 * document nobody selected owes no acknowledgement either.
 *
 *  1. Root the same reference absolutely.
 *  2. Cite the document by its path inside that root.
 *  3. Assert the graph closes.
 */
func TestACitationUnderAnAbsoluteRootResolvesThroughTheRoot(t *testing.T) {
  workspace := t.TempDir()
  docs := filepath.ToSlash(filepath.Join(workspace, "docs"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+docs+`",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies an absolute root written with backslashes is stored and named in one
 * slash-separated form.
 *
 * The end-to-end case above declares a relative root, which is the one form
 * where the declared spelling and the derived one coincide, so it cannot tell
 * the stored spelling from the old derivation. The form the acceptance actually
 * names is an absolute Windows path, and it is asserted here rather than through
 * the rule because a path with a drive letter is absolute on one platform and
 * relative on the other, while the spelling this stores is the same on both.
 *
 *  1. Normalize an absolute root written with backslashes.
 *  2. Resolve it against a project root.
 *  3. Assert the stored spelling and the printed label are the slashed form.
 */
func TestAnAbsoluteRootWithBackslashesIsStoredWithSlashes(t *testing.T) {
  normalized, problem := normalizeRootPath(`C:\contracts`)
  if problem != "" {
    t.Fatalf("an absolute Windows root is accepted, got: %s", problem)
  }
  if normalized != "C:/contracts" {
    t.Fatalf("normalized = %q, want %q", normalized, "C:/contracts")
  }
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), normalized)
  if base.Declared != "C:/contracts" {
    t.Fatalf("declared = %q, want %q", base.Declared, "C:/contracts")
  }
  if label := populationRootLabel(base); label != "C:/contracts" {
    t.Fatalf("label = %q, want %q", label, "C:/contracts")
  }
}

/**
 * Verifies a root the rule could not examine is not called missing.
 *
 * A stat fails on more than absence. When an unreadable parent hides the root,
 * the directory may already be there, and "create that directory" is the same
 * unfollowable repair a file occupying the path produces: the author does what
 * the message says, nothing changes, and the message returns. The rule does not
 * know which state it is in, so it says that and passes the operating system's
 * own reason through.
 *
 *  1. Describe the three states a failed stat leaves behind.
 *  2. Read each rendered sentence.
 *  3. Assert only the absent one asks for the directory to be created.
 */
func TestARootThatCouldNotBeExaminedIsNotCalledMissing(t *testing.T) {
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), "../contracts")
  denied := &fs.PathError{Op: "stat", Path: base.Absolute, Err: fs.ErrPermission}
  unexaminable := describeBaseDirectoryProblem(base, artifactMarkdown, false, denied)
  for _, expected := range []string{
    "could not examine the markdown root '../contracts'",
    "which resolves to '",
    "permission denied",
    "make that path reachable by this process",
    "it resolves against the ttsc project root",
  } {
    if !strings.Contains(unexaminable, expected) {
      t.Fatalf("expected %q in:\n%s", expected, unexaminable)
    }
  }
  if strings.Contains(unexaminable, "create that directory") {
    t.Fatalf("a directory that may already exist is not created:\n%s", unexaminable)
  }

  absent := describeBaseDirectoryProblem(
    base,
    artifactMarkdown,
    false,
    &fs.PathError{Op: "stat", Path: base.Absolute, Err: fs.ErrNotExist},
  )
  assertProblemContains(t, []string{absent}, "create that directory")
  if strings.Contains(absent, "could not examine") {
    t.Fatalf("an absent path is known to be absent:\n%s", absent)
  }
}
