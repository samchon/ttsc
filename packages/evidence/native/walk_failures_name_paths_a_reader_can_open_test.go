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
// verified rather than assumed. Permissions are restored before the test
// returns, because `t.TempDir` removes its tree afterwards and cannot descend
// into a directory it may not read.
func unreadableDirectory(t *testing.T, directory string) {
  t.Helper()
  if runtime.GOOS == "windows" {
    t.Skip("a walk failure needs a directory the process may not list")
  }
  if err := os.Chmod(directory, 0); err != nil {
    t.Skip("a walk failure needs a directory the process may not list")
  }
  t.Cleanup(func() { _ = os.Chmod(directory, 0o755) })
  if _, err := os.ReadDir(directory); err == nil {
    t.Skip("a walk failure needs a directory the process may not list")
  }
}

/**
 * Verifies a walk failure names its path the way every message beside it does.
 *
 * The path a `filepath.WalkDir` callback hands back is OS-native and absolute,
 * and it was printed as it arrived, so one loader spelled paths three ways
 * depending on which line reported. This is the whole contract in one table: a
 * default base, a base declared relatively, a base declared absolutely, and the
 * walk root itself, which arrives as its own base-relative path.
 *
 *  1. Compose the message for each base shape.
 *  2. Read the path it names.
 *  3. Assert it is project-relative, slash-separated, and free of a trailing dot.
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
    {"", ".", "."},
    {"../documents", "requirements/private", "../documents/requirements/private"},
    {"../documents", ".", "../documents"},
    {filepath.ToSlash(filepath.Join(workspace, "documents")), "requirements/private", "../documents/requirements/private"},
  } {
    base := resolvePopulationBase(root, entry.declared)
    problem := unreadableWalkEntryProblem(base, entry.relative, "Markdown", cause)
    want := "Evidence graph could not inspect '" + entry.expected +
      "': permission denied. Fix filesystem access so configured Markdown sources can be indexed."
    if problem != want {
      t.Fatalf("root %q entry %q:\n got %s\nwant %s", entry.declared, entry.relative, problem, want)
    }
    if strings.Contains(problem, "\\") {
      t.Fatalf("a path this rule prints carries no backslash: %s", problem)
    }
  }
}

/**
 * Verifies a walk failure and a file location under one base agree.
 *
 * The two sit beside each other in the same loader and an author reads them
 * together, so agreeing is the point rather than a coincidence of two helpers
 * happening to compose alike. Pinning them against each other is what keeps a
 * later change to one from silently separating them.
 *
 *  1. Take one base-relative path under a declared root.
 *  2. Spell it as a walk failure and as a loaded file's address.
 *  3. Assert the walk failure names exactly the address a reader would open.
 */
func TestAWalkFailureSpellsThePathItsFileMessageWouldSpell(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  base := resolvePopulationBase(root, "../documents")
  address := base.addressOf("requirements/pricing.md")
  problem := unreadableWalkEntryProblem(base, "requirements/pricing.md", "Markdown", errors.New("io"))
  if !strings.Contains(problem, "'"+address.Display+"'") {
    t.Fatalf("walk failure %q does not name the address %q", problem, address.Display)
  }
}

/**
 * Verifies the underlying filesystem error survives untouched.
 *
 * The cause belongs to the operating system and may embed an absolute path of
 * its own. Spelling the path this rule chose to print is one claim; rewriting a
 * sentence it did not author would be another, and would leave a reader unable
 * to match the message against the syscall that produced it.
 *
 *  1. Compose the message over a cause carrying an OS-native absolute path.
 *  2. Read the message.
 *  3. Assert the cause appears exactly as it was written.
 */
func TestAWalkFailurePassesItsCauseThroughUnchanged(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  cause := errors.New(`open C:\Users\one\docs\private: Access is denied.`)
  problem := unreadableWalkEntryProblem(
    resolvePopulationBase(root, "../documents"),
    "requirements/private",
    "Markdown",
    cause,
  )
  if !strings.Contains(problem, cause.Error()) {
    t.Fatalf("the cause is the filesystem's own sentence, got: %s", problem)
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
 *  3. Assert the failure names the project-relative path and no absolute one.
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
  if countProblemsContaining(messages, filepath.ToSlash(private)) != 0 {
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
 * The two walkers were the same defect written twice, and repairing one while
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
