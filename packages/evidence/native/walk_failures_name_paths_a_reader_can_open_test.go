package evidence

import (
  "errors"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// unreadableDirectory makes one directory refuse to be listed, or skips the
// case when the platform or the user will not let it.
//
// Windows does not express this through the permission bits `os.Chmod` reaches,
// and a process running as root ignores them on POSIX as well, so the state is
// verified rather than assumed. Each refusal says which one it was, because a
// lane that silently stopped denying would otherwise report these cases as
// passing while proving nothing.
//
// Permissions are restored before the test returns. `t.TempDir` removes its
// tree afterwards and cannot descend into a directory it may not read, and
// cleanups run in reverse order of registration, so this one runs first.
func unreadableDirectory(t *testing.T, directory string) {
  t.Helper()
  if runtime.GOOS == "windows" {
    t.Skip("windows does not deny a directory listing through the permission bits os.Chmod reaches")
  }
  if err := os.Chmod(directory, 0); err != nil {
    t.Skipf("this filesystem refused to drop the permissions: %v", err)
  }
  t.Cleanup(func() { _ = os.Chmod(directory, 0o755) })
  if _, err := os.ReadDir(directory); err == nil {
    t.Skip("this process may list a directory with no permission bits, so it is probably root")
  }
}

/**
 * Verifies a walk failure names its path the way every message beside it does.
 *
 * The path a `filepath.WalkDir` callback hands back is OS-native and absolute,
 * and it was printed as it arrived, so one loader spelled paths three ways
 * depending on which line reported. This covers the base shapes that change the
 * composition: no declared root, one declared relatively, and one declared
 * absolutely, where the location still ascends project-relatively.
 *
 *  1. Compose the message for each base shape.
 *  2. Read the path it names.
 *  3. Assert it is project-relative and slash-separated.
 */
func TestAWalkFailureNamesAPathAReaderCanOpen(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  cause := errors.New("permission denied")
  for _, entry := range []struct {
    declared string
    relative string
    expected string
  }{
    {"", "docs/private", "docs/private"},
    {"../documents", "requirements/private", "../documents/requirements/private"},
    {
      filepath.ToSlash(filepath.Join(workspace, "documents")),
      "requirements/private",
      "../documents/requirements/private",
    },
  } {
    base := resolvePopulationBase(root, entry.declared)
    problem := unreadableWalkEntryProblem(base, entry.relative, "Markdown", cause)
    want := "Evidence graph could not inspect '" + entry.expected +
      "': permission denied. Fix filesystem access so configured Markdown sources can be indexed."
    if problem != want {
      t.Fatalf("root %q entry %q:\n got %s\nwant %s", entry.declared, entry.relative, problem, want)
    }
  }
}

/**
 * Verifies the walker composes the path rather than printing the one it was
 * handed.
 *
 * This is the property the repair actually bought, and the unit case above
 * cannot prove it: reverting both walkers to print the callback's own argument
 * leaves every direct call to the message builder passing. The decision runs
 * here over a real OS-native absolute path, so a Windows lane covers it too,
 * where a genuine walk failure cannot be provoked at all.
 *
 *  1. Hand the decision an OS-native absolute path inside a declared root.
 *  2. Read the message it composes.
 *  3. Assert the population-relative spelling and no OS-native one.
 */
func TestAWalkerComposesThePathItPrints(t *testing.T) {
  workspace := t.TempDir()
  base := resolvePopulationBase(filepath.Join(workspace, "project"), "../documents")
  current := filepath.Join(base.Absolute, "requirements", "private")
  problem, relevant := unreadableEntryProblem(
    base,
    base.Absolute,
    "Markdown",
    current,
    errors.New("permission denied"),
    func(relative string) bool { return relative == "requirements/private" },
  )
  if !relevant {
    t.Fatal("a path the population reads is relevant")
  }
  if !strings.Contains(problem, "'../documents/requirements/private'") {
    t.Fatalf("the path is composed through the base, got: %s", problem)
  }
  if strings.Contains(problem, filepath.ToSlash(current)) {
    t.Fatalf("the callback's own argument is not what a reader opens: %s", problem)
  }
}

/**
 * Verifies a path outside the configured population stays silent.
 *
 * The negative twin. A permission this population never needed is not its
 * finding, and reporting it would turn an unrelated directory beside the
 * documents into a build error. The guard predates this change and has to
 * survive it.
 *
 *  1. Hand the decision a path the population does not read.
 *  2. Read what it returns.
 *  3. Assert it reports nothing.
 */
func TestAWalkFailureOutsideThePopulationIsNotReported(t *testing.T) {
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), "../documents")
  problem, relevant := unreadableEntryProblem(
    base,
    base.Absolute,
    "Markdown",
    filepath.Join(base.Absolute, "assets", "private"),
    errors.New("permission denied"),
    func(relative string) bool { return relative == "requirements/private" },
  )
  if relevant || problem != "" {
    t.Fatalf("an unread path owes no diagnostic, got %q", problem)
  }
}

/**
 * Verifies the underlying filesystem error survives untouched.
 *
 * The cause belongs to the operating system and may embed an absolute path of
 * its own, in that system's own separators. Spelling the path this rule chose to
 * print is one claim; rewriting a sentence it did not author would be another,
 * and would leave a reader unable to match the message against the syscall that
 * produced it.
 *
 *  1. Compose the message over a cause carrying an OS-native absolute path.
 *  2. Read the message.
 *  3. Assert the cause appears exactly as it was written.
 */
func TestAWalkFailurePassesItsCauseThroughUnchanged(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  cause := errors.New(`open C:\Users\one\documents\private: Access is denied.`)
  problem := unreadableWalkEntryProblem(
    resolvePopulationBase(root, "../documents"),
    "requirements/private",
    "Markdown",
    cause,
  )
  if !strings.Contains(problem, cause.Error()) {
    t.Fatalf("the cause is the filesystem's own sentence, got: %s", problem)
  }
  if !strings.Contains(problem, "'../documents/requirements/private'") {
    t.Fatalf("the path this rule prints is still its own, got: %s", problem)
  }
}

/**
 * Verifies a real Markdown walk failure reports the project-relative path.
 *
 * The unit cases above compose the message from a base a test built. This runs
 * the actual rule against a directory the process may not list, so the value the
 * walker hands the callback is the real one and the relevance guard above the
 * report is genuinely traversed.
 *
 *  1. Make a directory inside the configured globs unreadable.
 *  2. Run the rule.
 *  3. Assert the path the rule prints is project-relative.
 */
func TestARealMarkdownWalkFailureNamesTheProjectRelativePath(t *testing.T) {
  root := t.TempDir()
  private := filepath.Join(root, "docs", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.md"), []byte("## Hidden\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/public.md": "## Public {#public}\n",
    "src/sale.ts":    "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "could not inspect 'docs/private':")
  // The quoted segment is the path this rule chose. The cause after it belongs
  // to the operating system and legitimately carries an absolute path, so the
  // absence is asserted where the rule is the author.
  if countProblemsContaining(messages, "'"+filepath.ToSlash(private)+"'") != 0 {
    t.Fatalf(
      "the path this rule prints is project-relative:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a real walk failure under a declared root ascends through that root.
 *
 * `relativeProjectPath` answers relative to the base rather than to the project,
 * so a base above the project would otherwise print a path a reader cannot open
 * from where they are standing. Composing it through the base is what re-attaches
 * the root, and only a base that actually ascends proves it.
 *
 *  1. Root a Markdown reference above the project.
 *  2. Make a directory inside it unreadable and run the rule.
 *  3. Assert the failure ascends exactly as the file locations beside it do.
 */
func TestARealWalkFailureUnderADeclaredRootAscendsThroughIt(t *testing.T) {
  workspace := t.TempDir()
  private := filepath.Join(workspace, "documents", "requirements", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.md"), []byte("## Hidden\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "documents/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":               "export interface ISale {}\n",
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
    "could not inspect '../documents/requirements/private':",
  )
}

/**
 * Verifies a real Prisma walk failure answers exactly as the Markdown one does.
 *
 * The two walkers were the same decision written twice, and repairing one while
 * leaving the other reinstates by artifact kind the branch asymmetry #1236
 * removed. The Prisma half is exercised through its address collector rather
 * than the whole rule, because the Prisma bridge needs a linked feature suite
 * that this question does not depend on.
 *
 *  1. Make a directory inside a Prisma population unreadable.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the failure is project-relative and the base is recorded failed.
 */
func TestARealPrismaWalkFailureNamesTheProjectRelativePath(t *testing.T) {
  root := t.TempDir()
  private := filepath.Join(root, "prisma", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.prisma"), []byte("model Hidden {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
  }]}`)
  _, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertProblemContains(t, problems, "could not inspect 'prisma/private':")
  assertProblemContains(t, problems, "configured Prisma sources can be indexed")
  if len(failed) != 1 {
    t.Fatalf("a walk failure records its base failed, got %d", len(failed))
  }
}
