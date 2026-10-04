//go:build e2e

package driver_test

import (
  _ "embed"
  "errors"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "sync"
  "syscall"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// Each authored protocol response remains in its fixture package. One dispatcher
// links all packages; distinct executable names select the fixture without
// changing the product's argv or stdin protocol. Case cwd and logs stay isolated.
var nativeSidecarBuild struct {
  once sync.Once
  directory string
  binaries map[string]string
  err error
  retentionMu sync.Mutex
  retained bool
}

//go:embed testdata/native-plugin-source/go.mod.txt
var nativeSidecarModule string

func buildNativePluginSourceTestSidecar(t *testing.T, sourceText string) string {
  t.Helper()
  nativeSidecarBuild.once.Do(buildNativeSidecarBatch)
  if nativeSidecarBuild.err != nil { t.Fatalf("native sidecar producer failed: %v", nativeSidecarBuild.err) }
  binary, ok := nativeSidecarBuild.binaries[sourceText]
  if !ok { t.Fatal("sidecar source has no authored batch fixture") }
  return binary
}

func buildNativeSidecarBatch() {
  directory, err := os.MkdirTemp(os.Getenv("GOTMPDIR"), "ttsc-lsp-sidecars-")
  nativeSidecarBuild.directory = directory
  if err != nil { nativeSidecarBuild.err = err; return }
  if err := writeNativeSidecarBatch(directory); err != nil { nativeSidecarBuild.err = err; return }
  binary := filepath.Join(directory, "sidecar")
  if runtime.GOOS == "windows" { binary += ".exe" }
  build := exec.Command("go", "build", "-o", binary, ".")
  build.Dir = directory
  // This authored standard-library-only fixture module has no dependency on the
  // repository's Go workspace. Resolve the entire batch as its own one module.
  build.Env = append(os.Environ(), "GOWORK=off")
  observation := e2etrace.BeginCommand(build, "CombinedOutput", "native-lsp-sidecar-build")
  output, err := build.CombinedOutput()
  observation.Result(err)
  if err != nil {
    nativeSidecarBuild.err = fmt.Errorf("build native sidecar batch: %w\n%s", err, output)
    return
  }
  observation.Artifact(binary, "native-lsp-sidecar-built")
  artifact, err := os.ReadFile(binary)
  if err != nil { nativeSidecarBuild.err = err; return }
  for _, target := range nativeSidecarBuild.binaries {
    if err := os.WriteFile(target, artifact, 0o755); err != nil {
      nativeSidecarBuild.err = err
      return
    }
    // Observe each actual selected copy before sync.Once exposes this batch.
    // The filename label distinguishes payloads on the same build invocation;
    // these file bytes are not proof of a later process's loaded image.
    observation.Artifact(target, "native-lsp-sidecar-"+strings.TrimSuffix(filepath.Base(target), ".exe"))
  }
}

func writeNativeSidecarBatch(directory string) error {
  fixtures := []string{
    nativePluginSourceNullEditSidecar,
    nativePluginSourceStdoutAtLimitSidecar,
    nativePluginSourceCommandlessActionSidecar,
    nativePluginSourceDirectEditSidecar,
    nativePluginSourceUnownedCommandSidecar,
    nativePluginSourceDuplicateCommandFirstSidecar,
    nativePluginSourceDuplicateCommandSecondSidecar,
    nativePluginSourceContentStdinSidecar,
    nativePluginSourceDocumentChangesSidecar,
    nativePluginSourceOversizedStdoutSidecar,
    nativePluginSourceOversizedStderrSidecar,
    fakeLSPSidecarSource,
  }
  if err := os.WriteFile(filepath.Join(directory, "go.mod"), []byte(nativeSidecarModule), 0o644); err != nil { return err }
  nativeSidecarBuild.binaries = make(map[string]string, len(fixtures))
  var dispatcher strings.Builder
  dispatcher.WriteString("package main\nimport (\"os\"; \"path/filepath\"; \"strings\"\n")
  for i, fixture := range fixtures {
    name := fmt.Sprintf("fixture%d", i)
    fixtureDirectory := filepath.Join(directory, name)
    if err := os.Mkdir(fixtureDirectory, 0o755); err != nil { return err }
    // Only the package and entry declaration change; verb branches, malformed
    // payloads, size limits and deliberate exit failures are exactly authored.
    fixture = strings.Replace(fixture, "package main", "package "+name, 1)
    fixture = strings.Replace(fixture, "func main()", "func Run()", 1)
    if err := os.WriteFile(filepath.Join(fixtureDirectory, "sidecar.go"), []byte(fixture), 0o644); err != nil { return err }
    fmt.Fprintf(&dispatcher, "%s \"ttsc-sidecar-fixtures/%s\"\n", name, name)
    target := filepath.Join(directory, name)
    // Keep binary names outside the source directories on every platform.
    target += "-sidecar"
    if runtime.GOOS == "windows" { target += ".exe" }
    nativeSidecarBuild.binaries[fixtures[i]] = target
  }
  dispatcher.WriteString(")\nfunc main() { switch strings.TrimSuffix(filepath.Base(os.Args[0]), \".exe\") {\n")
  for i := range fixtures {
    fmt.Fprintf(&dispatcher, "case \"fixture%d-sidecar\": fixture%d.Run()\n", i, i)
  }
  dispatcher.WriteString("default: os.Exit(2)\n} }\n")
  return os.WriteFile(filepath.Join(directory, "main.go"), []byte(dispatcher.String()), 0o644)
}

// TestMain owns the one batch artifact until every case and -count repetition
// returns. Normal source fixture cleanup awaits its supported completion
// callback before suite teardown; this is not a full scheduler join. Only bounded Windows image-release denials
// are retried; persistent cleanup fails the suite. An unresolved source callback
// retains the producer directory instead of deleting a potentially running image.
//
// @evidence contracts/testing.md#behavioral-verification TestMain preserves m.Run status when no batch exists; for an allocated batch it attempts removal unless completion was retained, and retained or failed removal changes the exit status to 1.
// @evidence contracts/testing.md#independent-expectations The exit code is the oracle: a retained or undeletable directory turns a passing run into a failure instead of being ignored.
// @evidence contracts/testing.md#distinguishing-cases The entry implements no-batch, normal release, retained completion and bounded Windows access/sharing-denial branches; this declaration does not itself inject and prove every cleanup failure outcome.
// @evidence contracts/testing.md#execution-ownership TestMain is the package entry point for the test/driver binary; the sidecar batch is built lazily by the first test that needs it and released here after every case and -count repetition.
func TestMain(m *testing.M) {
  code := m.Run()
  nativeSidecarBuild.retentionMu.Lock()
  retained := nativeSidecarBuild.retained
  nativeSidecarBuild.retentionMu.Unlock()
  if directory := nativeSidecarBuild.directory; directory != "" && retained {
    fmt.Fprintf(os.Stderr, "unresolved native source completion; retained sidecar producer directory: %s\n", directory)
    code = 1
  }
  if directory := nativeSidecarBuild.directory; directory != "" && !retained {
    deadline := time.Now().Add(2*time.Second)
    for {
      err := os.RemoveAll(directory)
      if runtime.GOOS == "windows" && (errors.Is(err, syscall.Errno(5)) || errors.Is(err, syscall.Errno(32))) && time.Now().Add(10*time.Millisecond).Before(deadline) {
        time.Sleep(10*time.Millisecond)
        continue
      }
      if err != nil { fmt.Fprintf(os.Stderr, "remove sidecar batch: %v\n", err); code = 1 }
      break
    }
  }
  os.Exit(code)
}

// nativePluginSourceTestFixture owns a source and its native working directory.
// Cleanup can retain the directory when child completion cannot be established.
//
// Review grounds below cover this declaration and its callees.
// Go Evidence addresses exported declarations only; these native grounds
// remain part of the owning operation review rather than automated coverage.
//
// Common: Principled implementation: The successful constructor transfers its source into the same owner as its directory; an unconstructed source has no child lifetime to await.
// Common: Clear and simple design: One owner couples source completion to fixture reclamation instead of separate unrelated cleanup hooks.
// Common: Prohibited implementation shortcuts: Failed completion retains actual inputs rather than certifying closure or deleting resources still possibly in use.
// Common: Meaningful documentation: Native prose states the directory/source relationship and unresolved cleanup meaning.
// Portability: OS-neutral implementation: directory is a native MkdirTemp path used as the child's cwd; no protocol URI or inferred case policy supplies its identity.
// Performance: Not applicable: Efficient algorithms: The cleanup method owns its processing strategy.
// Performance: Not applicable: Reuse equivalent work: This record does not coordinate shared compilation.
// Performance: Not applicable: Bound retention and release resources: Acquisition and reclamation belong to the constructor and cleanup method.
type nativePluginSourceTestFixture struct {
  directory string
  source *driver.NativePluginSource
}

// newNativePluginSourceTestFixture allocates one private native cwd.
// Its registered cleanup awaits source children before removing that directory.
//
// Review grounds below cover this declaration and its callees.
// Go Evidence addresses exported declarations only; these native grounds
// remain part of the owning operation review rather than automated coverage.
//
// Common: Principled implementation: MkdirTemp allocates a native private directory; registering cleanup before construction also reclaims it when the source constructor fails.
// Common: Clear and simple design: The returned owner lets each case keep its direct product constructor and original assertions visible.
// Common: Prohibited implementation shortcuts: Allocation owns no fabricated protocol output or compiler behavior.
// Common: Meaningful documentation: Native paragraphs state private cwd allocation and the child-before-directory reclamation order.
// Portability: OS-neutral implementation: MkdirTemp uses the operating system's temporary root and native directory APIs, matching the former TempDir fixture role.
// Performance: Not applicable: Efficient algorithms: Allocating one directory chooses no population traversal algorithm.
// Performance: Not applicable: Reuse equivalent work: Case-local mutable cwd cannot share another source's input identity.
// Performance: Bound retention and release resources: One directory belongs to one case. Cleanup normally removes it after the callback barrier; unresolved completion retains it with a diagnostic and fails the suite.
func newNativePluginSourceTestFixture(t *testing.T) *nativePluginSourceTestFixture {
  t.Helper()
  directory, err := os.MkdirTemp("", "ttsc-lsp-source-")
  if err != nil { t.Fatal(err) }
  fixture := &nativePluginSourceTestFixture{directory: directory}
  t.Cleanup(func() { fixture.cleanup(t) })
  return fixture
}

// cleanup closes the source from a completed refresh callback before reclaiming cwd.
// The constructor starts a background hints refresh. Installing the observer and
// requesting a refresh during cleanup covers both its running and finished states.
// The callback runs after the cycle's native calls and holds neither the hints
// observer lock nor the scheduler lock. Close can therefore cancel the source,
// join resident children and discard queued cycles without those lock inversions.
//
// The callback barrier proves native child completion and prevents later child
// acquisition; it does not join the scheduler goroutine's final bookkeeping.
// A wait failure cancels the source and allows one further bounded wait. Failure
// to establish the barrier retains this cwd and the shared producer directory.
// Source Close itself has no separate timeout for its resident join.
//
// Review grounds below cover this declaration and its callees.
// Go Evidence addresses exported declarations only; these native grounds
// remain part of the owning operation review rather than automated coverage.
//
// Common: Principled implementation: The observer is notified after discoverCompletionHints finishes its native calls. Closing from that callback prevents queued future refreshes and joins residents before the completion result is sent; the existing synchronous case operations have already returned.
// Common: Clear and simple design: One callback result connects child completion to directory deletion. The fixture owner reports and retains unresolved inputs instead of delegating reclamation to an unconditional TempDir hook.
// Common: Prohibited implementation shortcuts: Supported observer, refresh and Close APIs establish the lifecycle without replacing product globals or reading private scheduler state. A timeout remains a test failure and is never interpreted as completion.
// Common: Meaningful documentation: Native paragraphs explain constructor concurrency, callback lock ordering, cancellation, the barrier's exact scope and exceptional retention.
// Portability: OS-neutral implementation: Go channels and the source's native process APIs establish completion. Native removal retries only actual Windows access/share denials; unresolved execution retains native directory paths on all systems.
// Performance: Efficient algorithms: One callback and two bounded waits coordinate a fixed source; recursive removal scales only with the owned authored fixture contents.
// Performance: Reuse equivalent work: The explicit cleanup refresh guarantees an observable completion even when construction's refresh already finished. It coalesces with an in-flight cycle through the public scheduler; it changes no compiled artifact and no case result is reused.
// Performance: Bound retention and release resources: Normal completion closes source children before cwd removal. Thirty seconds then ten seconds bound callback waits; synchronous Close has no separate join timeout. Unresolved completion retains this fixture plus the fixed shared producer, prints their paths and fails the suite. No full scheduler-goroutine join or release of retained exceptional inputs is claimed.
func (fixture *nativePluginSourceTestFixture) cleanup(t *testing.T) {
  t.Helper()
  if fixture.source != nil {
    completed := make(chan error, 1)
    var closeOnce sync.Once
    fixture.source.SetCompletionHintsObserver(func() {
      closeOnce.Do(func() { completed <- fixture.source.Close() })
    })
    fixture.source.RefreshCompletionHints()
    var closeErr error
    joined := false
    timer := time.NewTimer(30*time.Second)
    select {
    case closeErr = <-completed:
      joined = true
    case <-timer.C:
      t.Error("native source refresh did not complete during cleanup in 30s")
      if err := fixture.source.Close(); err != nil {
        t.Errorf("cancel native source after incomplete refresh: %v", err)
      }
      recovery := time.NewTimer(10*time.Second)
      select {
      case closeErr = <-completed:
        joined = true
      case <-recovery.C:
      }
      recovery.Stop()
    }
    timer.Stop()
    if !joined || closeErr != nil {
      nativeSidecarBuild.retentionMu.Lock()
      nativeSidecarBuild.retained = true
      nativeSidecarBuild.retentionMu.Unlock()
      t.Errorf("native source cleanup unresolved (callback=%v, close=%v); retained fixture directory: %s", joined, closeErr, fixture.directory)
      return
    }
    fixture.source.SetCompletionHintsObserver(nil)
  }
  deadline := time.Now().Add(2*time.Second)
  for {
    err := os.RemoveAll(fixture.directory)
    if runtime.GOOS == "windows" && (errors.Is(err, syscall.Errno(5)) || errors.Is(err, syscall.Errno(32))) && time.Now().Add(10*time.Millisecond).Before(deadline) {
      time.Sleep(10*time.Millisecond)
      continue
    }
    if err != nil { t.Errorf("remove native source fixture directory %s: %v", fixture.directory, err) }
    return
  }
}
