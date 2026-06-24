package driver

import (
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// Session is a resident compiler host for incremental type-checking: it keeps a
// loaded program alive and re-parses only the changed file on each edit (reusing
// the unchanged ASTs and the pinned checker through UpdateProgram), instead of
// recompiling the whole project per request.
//
// It is the driver-level incremental type-check primitive. The resident
// transform path (utility-host `serve`) deliberately does not use it: the
// linked-plugin pass mutates source ASTs in place, so a transform cannot reuse a
// warm clean program and must rebuild a fresh one per edit. Session therefore
// provides type-check reuse, not transform reuse (samchon/ttsc#255).
//
// Construct one per project (cwd absolute), feed file edits through Apply, and
// read the resident program's source through SourceText. Apply reuses the
// existing program when the edited file's import/reference graph is unchanged.
type Session struct {
  cwd     string
  overlay *OverlayFS
  prog    *Program
}

// NewSession loads the project over an overlay filesystem and keeps the
// resulting program resident. cwd must be absolute; tsconfig may be relative.
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
func (s *Session) Apply(absPath, content string) bool {
  s.overlay.Set(absPath, content)
  name := absPath
  if file := s.prog.SourceFile(absPath); file != nil {
    name = file.FileName()
  }
  changed := shimtspath.ToPath(name, s.cwd, s.overlay.caseSensitive)
  newHost := DefaultHost(s.cwd, s.overlay)
  newProg, reused := s.prog.TSProgram.UpdateProgram(changed, newHost, nil)
  if newProg != nil {
    s.prog.TSProgram = newProg
    s.prog.Host = newHost
  }
  return reused
}

// Program returns the resident program, reflecting every Apply so far. The
// handle changes when an edit reshapes the import graph, so callers should read
// it after Apply rather than caching it across edits.
func (s *Session) Program() *Program {
  return s.prog
}

// SourceText returns the source text the resident program currently holds for
// absPath, or ("", false) when the program has no such file.
func (s *Session) SourceText(absPath string) (string, bool) {
  file := s.prog.SourceFile(absPath)
  if file == nil {
    return "", false
  }
  return file.Text(), true
}

// Close releases the resident program's resources.
func (s *Session) Close() error {
  if s.prog != nil {
    return s.prog.Close()
  }
  return nil
}
