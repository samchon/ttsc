package driver

import (
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// Session is a resident compiler host: it keeps a loaded program alive and
// updates it incrementally as files change, instead of recompiling the whole
// project per request. It is the driver-level foundation for an incremental
// @ttsc/metro and @ttsc/unplugin host (samchon/ttsc#255).
//
// Construct one per project, feed file edits through Apply, and read the
// resident program's source through SourceText. Apply reuses the existing
// program when the edited file's import/reference graph is unchanged.
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
