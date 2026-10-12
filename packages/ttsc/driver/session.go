package driver

import (
  "context"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// Session is a resident compiler host for incremental type-checking: it keeps a
// loaded program alive across single-file edits. Native UpdateProgram either
// builds a new generation reusing eligible old data or reconstructs the program;
// its reused-data result does not mean the old Program object is returned.
//
// It is the driver-level incremental type-check primitive. The resident
// transform path (utility-host `serve`) deliberately does not use it: the
// linked-plugin pass mutates source ASTs in place, so a transform cannot reuse a
// warm clean program and must rebuild a fresh one per edit. Session therefore
// provides type-check reuse, not transform reuse.
//
// Construct one per project (cwd absolute), feed file edits through Apply, and
// read the resident program's source through SourceText. Apply reuses the
// old program data when native file/parse/reference compatibility and package
// redirect checks permit it. Apply requires an existing resident member and
// the native single-changed-file precondition; config or broader filesystem
// changes require the caller's reload policy.
//
// @evidence contracts/common.md#principled-implementation A project anchor, overlay and Program represent one resident type-checking session; transformed mutable AST reuse is not its contract.
// @evidence contracts/common.md#clear-and-simple-design The session groups incremental state while filesystem overrides and compiler operations keep their own owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reuse uses TypeScript-Go UpdateProgram rather than a fixture cache or patched checker method.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish type-check reuse from transforms and state anchor and edit behavior under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The supplied absolute anchor and overlay use native lexical compiler paths and reported case policy; this representation performs no independent directory capability or physical-alias probe.
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
// The session installs its own DefaultFS overlay, replacing options.FS. A
// failed or absent program load returns no Session, with the load diagnostics.
//
// @evidence contracts/common.md#principled-implementation Loading over the same overlay retained by the session lets subsequent edits reach the compiler's filesystem.
// @evidence contracts/common.md#clear-and-simple-design Construction creates one overlay and delegates config and checker setup to LoadProgram.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A failed load returns diagnostics instead of manufacturing an empty resident Program.
// @evidence contracts/common.md#meaningful-documentation Native prose states resident ownership and absolute-cwd precondition following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation DefaultFS supplies native capabilities and the overlay uses that case policy without OS-name inference.
// @evidence contracts/performance.md#efficient-algorithms Construction adds a fresh native metadata-cache/overlay and delegates config parsing, input discovery, full program construction and checker setup. Config/source/path bytes and reached native entries drive loading work and retained state; delegation does not make compilation constant-cost.
// @evidence contracts/performance.md#reuse-equivalent-work One loaded Program serves later session edits; updates use its existing compiler state instead of loading on every request.
// @evidence contracts/performance.md#bound-retention-and-release-resources A successful session owns the current checker lease and retains its Program, native filesystem caches and overlay. Program data, metadata and distinct overridden text have no session-wide byte/population cap. Close releases the checker lease; dropping caller ownership allows remaining state to be reclaimed only when other aliases no longer retain it.
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
// resident program. absPath must identify an existing resident member, and the
// caller must satisfy native UpdateProgram's single-changed-file precondition.
// True means the new generation reused old program data; false selects full
// reconstruction. Native parse/reference/package-redirect checks decide this,
// not import graph equality alone. The driver facade itself remains stable.
//
// @evidence contracts/common.md#principled-implementation The edited overlay is installed before UpdateProgram; a returned replacement checker and host replace the corresponding facade fields together.
// @evidence contracts/common.md#clear-and-simple-design One operation owns buffer update, incremental compiler update and checker-lease replacement.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler's update result determines reuse, with no filename-specific bypass or invented success.
// @evidence contracts/common.md#meaningful-documentation Native prose explains true and false reuse results following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Resident member spelling, the Program's base directory and its case policy produce the native path key; these are lexical compiler keys, not independent physical-alias or directory capability proofs.
// @evidence contracts/performance.md#efficient-algorithms Overlay/key setup processes path bytes; SourceFile may run pending linked hooks before indexed lookup. Native update reads/parses the edited member and either clones file collections and initializes a new checker pool while sharing eligible data, or performs full reconstruction. File/reference/source populations and native host work therefore remain costs even on a reused-data result.
// @evidence contracts/performance.md#reuse-equivalent-work Under the caller's existing-member/single-change contract, native parse options, import/reference/augmentation/ambient-name compatibility and package-redirect checks determine data reuse. Every successful result is a new Program generation; transformed mutable AST reuse is not supported by this type-check session contract.
// @evidence contracts/performance.md#bound-retention-and-release-resources A returned replacement releases the old checker lease before acquiring/installing the new checker and host. Current native data and uncapped overlay text remain session-owned, with earlier generation data possibly shared or retained by other aliases; lease replacement does not bound bytes or reclaim all old state. Close and caller ownership govern later release.
func (s *Session) Apply(absPath, content string) bool {
  s.overlay.Set(absPath, content)
  name := absPath
  if file := s.prog.SourceFile(absPath); file != nil {
    name = file.FileName().AsString()
  }
  changed := s.prog.TSProgram.PathKeyForFileName(shimtspath.ToRootedFilePath(name, s.prog.TSProgram.GetCurrentDirectory()))
  newHost := DefaultHost(s.prog.FS)
  newProg, _, reused := s.prog.TSProgram.UpdateProgram(changed, newHost, nil, nil)
  if newProg != nil {
    e2etrace.Program("program-construction", "driver-update", "constructor-returned", reused, newProg)
    if s.prog.checkerRelease != nil {
      s.prog.checkerRelease()
    }
    checker, release := newProg.GetTypeChecker(context.Background())
    s.prog.TSProgram = newProg
    s.prog.Checker = checker
    s.prog.checkerRelease = release
    s.prog.Host = newHost
    e2etrace.Program("program-load-outcome", "driver-update", "facade-installed", reused, newProg)
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
// The delegated SourceFile lookup may first run pending linked hooks; their
// latched failure is not returned by this text accessor. Text is the resident
// parsed version, including any source-level preamble, not a new disk receipt.
//
// @evidence contracts/common.md#principled-implementation Lookup returns the resident source's text, distinguishing a missing file from empty content with the boolean.
// @evidence contracts/common.md#clear-and-simple-design Source text retrieval delegates identity lookup to Program.SourceFile rather than duplicating it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No disk reread is substituted for the resident source version.
// @evidence contracts/common.md#meaningful-documentation Native prose states resident-version and missing-file behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Path lookup uses the driver Program's normalized source-file spelling; no native capability is inferred from OS names.
// @evidence contracts/performance.md#efficient-algorithms Program.SourceFile adds path normalization/hash work and indexed lookup, plus any first pending linked-hook execution and its delegated source/native costs. Once hooks are latched this accessor introduces no separate reread or parse; it returns the resident text string without copying its bytes.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor reads state already owned by the session and does not coordinate compilation requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returning a string reference does not create a session-owned historical buffer or checker lease.
func (s *Session) SourceText(absPath string) (string, bool) {
  file := s.prog.SourceFile(absPath)
  if file == nil {
    return "", false
  }
  return file.Text(), true
}

// Close releases the current Program's checker lease. It does not clear the
// resident Program or overlay, dispose all native data, or forbid later calls.
//
// @evidence contracts/common.md#principled-implementation Closing the current Program releases its checker lease; an absent Program has no lease to release.
// @evidence contracts/common.md#clear-and-simple-design Session cleanup delegates lease ownership to Program.Close without a second release ledger.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup uses the recorded release callback rather than suppressing a compiler failure or guessing an upstream handle.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies cleanup responsibility following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This cleanup delegates an in-process checker lease and crosses no native path or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms Cleanup contains no input-dependent algorithm or data-structure choice.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Lease release does not decide equivalence of compilation requests.
// @evidence contracts/performance.md#bound-retention-and-release-resources Sequential repeated Close is safe through Program.Close's cleared lease-release callback. The Session still retains its Program, FS/cache and overlay; caller ownership and other aliases govern their later reclamation, with no cleared-buffer or full native-disposal promise from this method.
func (s *Session) Close() error {
  if s.prog != nil {
    return s.prog.Close()
  }
  return nil
}
