package evidence

import (
  "io/fs"
  "os"
  "path/filepath"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// evidenceInputReader delegates only the operations an inventory or locator
// actually performs. A nil host reader preserves the original OS operations
// for manual contexts and native unit callers. It never preloads a population.
type evidenceInputReader struct { host rule.ProjectInputReader }

// ReadFile routes actual raw consumption through the generation reader when
// supplied. Nil manual contexts keep os.ReadFile's bytes and error semantics.
func (r evidenceInputReader) ReadFile(name string) ([]byte, error) {
  if r.host != nil { return r.host.ReadFile(name) }
  return os.ReadFile(name)
}
// Stat delegates target metadata without changing native link following.
func (r evidenceInputReader) Stat(name string) (os.FileInfo, error) {
  if r.host != nil { return r.host.Stat(name) }
  return os.Stat(name)
}
// Lstat keeps entry metadata distinct from the followed target; an observing
// host owns withdrawal when its protocol cannot represent that native entry.
func (r evidenceInputReader) Lstat(name string) (os.FileInfo, error) {
  if r.host != nil { return r.host.Lstat(name) }
  return os.Lstat(name)
}
// Readlink preserves native target text and errors instead of resolving it.
func (r evidenceInputReader) Readlink(name string) (string, error) {
  if r.host != nil { return r.host.Readlink(name) }
  return os.Readlink(name)
}
// WalkDir delegates callback ordering and SkipDir/SkipAll behavior. Neither
// branch preloads unvisited populations or retains a separate walk cache.
func (r evidenceInputReader) WalkDir(name string, visit fs.WalkDirFunc) error {
  if r.host != nil { return r.host.WalkDir(name, visit) }
  return filepath.WalkDir(name, visit)
}
// Unavailable propagates unsupported external consumption to the observing
// host; a nil manual context has no reusable input authority to withdraw.
func (r evidenceInputReader) Unavailable() {
  if r.host != nil { r.host.Unavailable() }
}
// inputReader preserves optional variadic-call compatibility: only the first
// supplied reader belongs to this operation, otherwise native calls remain.
func inputReader(readers []evidenceInputReader) evidenceInputReader {
  if len(readers) != 0 { return readers[0] }
  return evidenceInputReader{}
}

// EvalSymlinks preserves native resolution and returned spelling; observation
// coordinates and unresolved-proof refusal belong to the supplied host.
func (r evidenceInputReader) EvalSymlinks(name string) (string, error) {
  if r.host != nil { return r.host.EvalSymlinks(name) }
  return filepath.EvalSymlinks(name)
}
