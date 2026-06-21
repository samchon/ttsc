package driver

import (
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
)

// OverlayFS layers in-memory file contents over an inner filesystem. Overridden
// paths return the in-memory text from ReadFile and report present from
// FileExists; every other operation delegates to the inner FS. A resident
// Session or serve host uses this to feed a caller's unsaved buffer (for example
// Metro's per-file src, or an editor's edited file) to the compiler without
// writing to disk.
type OverlayFS struct {
  vfs.FS
  caseSensitive bool
  overrides     map[string]string
}

// NewOverlayFS returns an overlay over inner with no overrides set.
func NewOverlayFS(inner vfs.FS) *OverlayFS {
  return &OverlayFS{
    FS:            inner,
    caseSensitive: inner.UseCaseSensitiveFileNames(),
    overrides:     map[string]string{},
  }
}

// key normalizes a path the same way the compiler keys its files, so an
// override registered for one spelling is found however the host asks for it.
func (o *OverlayFS) key(path string) string {
  return shimtspath.GetCanonicalFileName(shimtspath.NormalizePath(path), o.caseSensitive)
}

// Set records an in-memory override for path.
func (o *OverlayFS) Set(path, content string) {
  o.overrides[o.key(path)] = content
}

func (o *OverlayFS) ReadFile(path string) (string, bool) {
  if content, ok := o.overrides[o.key(path)]; ok {
    return content, true
  }
  return o.FS.ReadFile(path)
}

func (o *OverlayFS) FileExists(path string) bool {
  if _, ok := o.overrides[o.key(path)]; ok {
    return true
  }
  return o.FS.FileExists(path)
}
