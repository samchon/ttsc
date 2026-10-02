package driver

import (
  "context"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// Session is a resident compiler host for incremental type-checking: it keeps a
// loaded program alive and re-parses only the changed file on each edit (reusing
// the unchanged ASTs and refreshing the checker for the updated Program),
// instead of recompiling the whole project per request.
//
// It is the driver-level incremental type-check primitive. The resident
// transform path (utility-host `serve`) deliberately does not use it: the
// linked-plugin pass mutates source ASTs in place, so a transform cannot reuse a
// warm clean program and must rebuild a fresh one per edit. Session therefore
// provides type-check reuse, not transform reuse.
//
// Construct one per project (cwd absolute), feed file edits through Apply, and
// read the resident program's source through SourceText. Apply reuses the
// existing program when the edited file's import/reference graph is unchanged.
//
// @evidence contracts/common.md#principled-implementation A project anchor, overlay and Program represent one resident type-checking session; transformed mutable AST reuse is not its contract.
// @evidence contracts/common.md#clear-and-simple-design The session groups incremental state while filesystem overrides and compiler operations keep their own owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reuse uses TypeScript-Go UpdateProgram rather than a fixture cache or patched checker method.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish type-check reuse from transforms and state anchor and edit behavior under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The project anchor and overlay preserve compiler path canonicalization using actual filesystem case capability.
// @evidenceExclude contracts/performance.md#efficient-algorithms This type groups resident state; NewSession and Apply choose its processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The representation does not independently decide whether an edit can reuse a Program.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resource acquisition and lease release belong to the session's constructor, Apply and Close operations.
type Session struct {
  cwd     string
  overlay *OverlayFS
  prog    *Program
}

// NewSession loads the project over an overlay filesystem and keeps the
// resulting program resident. cwd must be absolute; tsconfig may be relative.
//
// @evidence contracts/common.md#principled-implementation Loading over the same overlay retained by the session lets subsequent edits reach the compiler's filesystem.
// @evidence contracts/common.md#clear-and-simple-design Construction creates one overlay and delegates config and checker setup to LoadProgram.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A failed load returns diagnostics instead of manufacturing an empty resident Program.
// @evidence contracts/common.md#meaningful-documentation Native prose states resident ownership and absolute-cwd precondition following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation DefaultFS supplies native capabilities and the overlay uses that case policy without OS-name inference.
// @evidenceExclude contracts/performance.md#efficient-algorithms The constructor delegates compilation to LoadProgram rather than choosing another compiler algorithm.
// @evidence contracts/performance.md#reuse-equivalent-work One loaded Program serves later session edits; updates use its existing compiler state instead of loading on every request.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned Session owns one Program checker lease and overlay; Close releases the lease, and caller release of the session frees its buffers.
func NewSession(cwd, tsconfig string, options LoadProgramOptions) (*Session, []Diagnostic, error) {
  overlay := NewOverlayFS(DefaultFS())
  options.FS = overlay
  prog, diags, err := LoadProgram(cwd, tsconfig, options)
  if err != nil {
    return nil, diags, err
  }
  if prog == nil {
    return nil, diags, nil
  }
  return &Session{cwd: cwd, overlay: overlay, prog: prog}, nil, nil
}

// Apply sets the in-memory content of one file and incrementally updates the
// resident program. It returns whether the update reused the existing program
// (true) or had to rebuild it because the file's import/reference graph changed
// (false).
//
// @evidence contracts/common.md#principled-implementation The edited overlay is installed before UpdateProgram; a returned replacement checker and host replace the corresponding facade fields together.
// @evidence contracts/common.md#clear-and-simple-design One operation owns buffer update, incremental compiler update and checker-lease replacement.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler's update result determines reuse, with no filename-specific bypass or invented success.
// @evidence contracts/common.md#meaningful-documentation Native prose explains true and false reuse results following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The resident file spelling and ToPath use the overlay's actual case policy before UpdateProgram.
// @evidence contracts/performance.md#efficient-algorithms UpdateProgram chooses incremental reparsing; the adapter's resident-file lookup reuses the compiler's indexed lookup after path canonicalization.
// @evidence contracts/performance.md#reuse-equivalent-work TypeScript-Go determines whether unchanged import and reference structure permits reuse; mutable transformed ASTs must not use this type-check reuse path.
// @evidence contracts/performance.md#bound-retention-and-release-resources A replacement Program releases the prior checker lease before acquiring its new checker; one current lease remains owned by the session.
func (s *Session) Apply(absPath, content string) bool {
  s.overlay.Set(absPath, content)
  name := absPath
  if file := s.prog.SourceFile(absPath); file != nil {
    name = file.FileName()
  }
  changed := shimtspath.ToPath(name, s.cwd, s.overlay.caseSensitive)
  newHost := DefaultHost(s.cwd, s.prog.FS)
  newProg, reused := s.prog.TSProgram.UpdateProgram(changed, newHost, nil)
  if newProg != nil {
    if s.prog.checkerRelease != nil {
      s.prog.checkerRelease()
    }
    checker, release := newProg.GetTypeChecker(context.Background())
    s.prog.TSProgram = newProg
    s.prog.Checker = checker
    s.prog.checkerRelease = release
    s.prog.Host = newHost
  }
  return reused
}

// Program returns the resident driver facade, reflecting every Apply so far.
// Apply can replace its TSProgram, Checker, and Host; callers must not retain
// those generation-specific fields across edits.
//
// @evidence contracts/common.md#principled-implementation The current facade pointer exposes the compiler state installed by the latest Apply.
// @evidence contracts/common.md#clear-and-simple-design This accessor introduces no second Program copy or ownership wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The accessor returns actual resident state without a stale-result fallback.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the stable facade from replaceable generation-specific fields under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Returning an existing Program pointer performs no native filesystem or process boundary operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms This accessor performs no algorithm choice or input-dependent computation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Retrieval does not establish whether resident compiler work remains valid.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This borrowed handle accessor acquires or releases no owned resource.
func (s *Session) Program() *Program {
  return s.prog
}

// SourceText returns the source text the resident program currently holds for
// absPath, or ("", false) when the program has no such file.
//
// @evidence contracts/common.md#principled-implementation Lookup returns the resident source's text, distinguishing a missing file from empty content with the boolean.
// @evidence contracts/common.md#clear-and-simple-design Source text retrieval delegates identity lookup to Program.SourceFile rather than duplicating it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No disk reread is substituted for the resident source version.
// @evidence contracts/common.md#meaningful-documentation Native prose states resident-version and missing-file behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Path lookup uses the driver Program's normalized source-file spelling; no native capability is inferred from OS names.
// @evidence contracts/performance.md#efficient-algorithms The accessor shares the compiler's indexed lookup through Program.SourceFile; normalization costs depend on path length, and source bytes are not parsed or read again.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor reads state already owned by the session and does not coordinate compilation requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returning a string reference does not create a session-owned historical buffer or checker lease.
func (s *Session) SourceText(absPath string) (string, bool) {
  file := s.prog.SourceFile(absPath)
  if file == nil {
    return "", false
  }
  return file.Text(), true
}

// Close releases the resident program's resources.
//
// @evidence contracts/common.md#principled-implementation Closing the current Program releases its checker lease; an absent Program has no lease to release.
// @evidence contracts/common.md#clear-and-simple-design Session cleanup delegates lease ownership to Program.Close without a second release ledger.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup uses the recorded release callback rather than suppressing a compiler failure or guessing an upstream handle.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies cleanup responsibility following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This cleanup delegates an in-process checker lease and crosses no native path or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms Cleanup contains no input-dependent algorithm or data-structure choice.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Lease release does not decide equivalence of compilation requests.
// @evidence contracts/performance.md#bound-retention-and-release-resources The session releases its current Program lease; repeated Close is safe through Program.Close's cleared release callback, while retained overlay buffers live until caller release.
func (s *Session) Close() error {
  if s.prog != nil {
    return s.prog.Close()
  }
  return nil
}
