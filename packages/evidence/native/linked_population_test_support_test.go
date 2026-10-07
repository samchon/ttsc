package evidence

import (
  "encoding/json"
  "io/fs"
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// linkPolicyFixture is an explicitly synthetic metadata model for the resolver's
// policy unit. Its target Stat succeeds for every modeled link, independently
// of a native kernel's link-following budget. Native graph cases never use it.
// Embedding unused operations makes an unexpected operation fail loudly.
//
// The authored map isolates the rule bound from kernel capacity. Only the
// resolver policy unit receives this synthetic reader; native graph cases and
// observed input proofs never do. Native fixture metadata supplies entry kinds.
type linkPolicyFixture struct {
  rule.ProjectInputReader
  links map[string]string
  target string
  directory, link os.FileInfo
}

// Stat models target queries that can follow the complete authored chain.
func (fixture linkPolicyFixture) Stat(name string) (os.FileInfo, error) {
  name = filepath.ToSlash(name)
  if _, ok := fixture.links[name]; ok || name == fixture.target {
    return fixture.directory, nil
  }
  return nil, fs.ErrNotExist
}

// Lstat distinguishes each authored link entry from the terminal directory.
func (fixture linkPolicyFixture) Lstat(name string) (os.FileInfo, error) {
  name = filepath.ToSlash(name)
  if _, ok := fixture.links[name]; ok {
    return fixture.link, nil
  }
  if name == fixture.target {
    return fixture.directory, nil
  }
  return nil, fs.ErrNotExist
}

// Readlink returns the authored preceding entry without computing resolution.
func (fixture linkPolicyFixture) Readlink(name string) (string, error) {
  if target, ok := fixture.links[filepath.ToSlash(name)]; ok {
    return target, nil
  }
  return "", fs.ErrInvalid
}

// linkedPopulationWorkspace removes incidental temporary-root symlinks before
// measuring a fixture's authored link count.
//
// Native physical-path resolution establishes the real root without assuming a
// Darwin path spelling or Go junction classification. Resolution failures fail preparation. The testing
// framework owns removal of the original temporary directory and its contents.
func linkedPopulationWorkspace(t *testing.T) string {
  t.Helper()
  original := t.TempDir()
  workspace, err := linkedPopulationPhysicalRoot(original)
  if err != nil {
    t.Fatal(err)
  }
  originalInfo, err := os.Stat(original)
  if err != nil {
    t.Fatal(err)
  }
  physicalInfo, err := os.Stat(workspace)
  if err != nil || !os.SameFile(originalInfo, physicalInfo) {
    t.Fatalf("physical fixture root %q does not identify native temporary root %q: %v", workspace, original, err)
  }
  return workspace
}

// linkPopulationDirectory keeps POSIX targets relative so each authored hop
// consumes one native link, while the existing Windows boundary creates junctions.
//
// filepath.Rel supplies native relative text for POSIX links. Windows keeps
// the existing absolute-target junction command boundary. Creation errors are
// preserved; neither unsupported privileges nor native failures skip a case.
func linkPopulationDirectory(t *testing.T, target, link string) error {
  t.Helper()
  if runtime.GOOS != "windows" {
    relative, err := filepath.Rel(filepath.Dir(link), target)
    if err != nil {
      return err
    }
    target = relative
  }
  return linkDirectory(t, target, link)
}

// assertLinkedPopulationRefusal compares a declared-root diagnostic with the
// independent native Stat gate, retaining the bounded-resolver assertion when
// that gate permits traversal.
//
// Actual Stat chooses the reachable branch without an OS-name expectation.
// A successful target query retains the rule-bound assertion; a failed query
// requires the native PathError cause and forbids guessing a rule-bound cause.
func assertLinkedPopulationRefusal[T string | graphDiagnostic](t *testing.T, messages []T, absolute, kind, declared string) {
  t.Helper()
  info, err := os.Stat(absolute)
  if err == nil {
    if !info.IsDir() {
      t.Fatal("link fixture did not target a directory")
    }
    assertProblemContains(t, messages, "found no directory at the end of the "+kind+" root '"+declared+"'")
    assertProblemContains(t, messages, "a chain of links longer than this rule follows")
    return
  }
  assertProblemContains(t, messages, "could not examine the "+kind+" root '"+declared+"'")
  native, ok := err.(*os.PathError)
  if !ok {
    t.Fatalf("native Stat returned a non-path error: %v", err)
  }
  assertProblemContains(t, messages, native.Err.Error())
  if countProblemsContaining(messages, "a chain of links longer than this rule follows") != 0 {
    t.Fatalf("native refusal was replaced with a rule-bound guess: %v", messages)
  }
}

// assertUnreachableLinkedProject exercises the real project gate when native
// Stat cannot traverse a fixture. Sources cannot be read behind that failed
// prerequisite, and the gate must answer before inventory materialization.
//
// The caller independently observed native Stat failure. No reader makes
// that target accessible. The real gate runs before source materialization, so
// the source-free context must yield exactly its authored identity diagnostic.
func assertUnreachableLinkedProject(t *testing.T, root, config string) {
  t.Helper()
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root}, nil, nil,
    rule.SeverityError, json.RawMessage(config), reporter,
  ))
  expected := "Evidence graph project root '"+root+"' is not a readable directory. Fix the ttsc project identity before evaluating evidence globs."
  if len(reporter.messages) != 1 || reporter.messages[0] != expected {
    t.Fatalf("native-inaccessible project messages=%q, want only %q", reporter.messages, expected)
  }
}
