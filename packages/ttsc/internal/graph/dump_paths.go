package graph

import (
  "fmt"
  "path/filepath"
  "runtime"
  "strings"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// dumpPathMapper owns the schema-v6 path vocabulary for one dump. Every
// identity-bearing path passes through this one cache, so the producer can
// reject both an unportable filesystem root and a non-injective projection
// before any JSON is written.
type dumpPathMapper struct {
  rawProject    string
  project       string
  caseSensitive bool
  canonicalize  func(string) string

  rawToWire      map[string]string
  physicalToWire map[string]string
  wireToPhysical map[string]string
  mappingErr     error
}

func newDumpPathMapper(project string) *dumpPathMapper {
  raw := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(project))
  normalized := canonicalDumpPath(raw)
  mapper := &dumpPathMapper{
    rawProject:     raw,
    project:        normalized,
    caseSensitive:  dumpPathRootIsCaseSensitive(normalized),
    canonicalize:   canonicalDumpPath,
    rawToWire:      map[string]string{},
    physicalToWire: map[string]string{},
    wireToPhysical: map[string]string{},
  }
  if normalized == "" || shimtspath.GetRootLength(normalized) == 0 {
    mapper.mappingErr = fmt.Errorf("ttscgraph: project root %q is not absolute", project)
  }
  return mapper
}

// mapPath returns one portable, slash-normalized coordinate:
//
//   - project files stay project-relative;
//   - same-root siblings use `../` segments, preserving workspace structure;
//   - package paths keep their full resolution context instead of collapsing
//     to the last node_modules tail;
//   - compiler virtual paths keep their bundled identity.
//
// A source on another drive or UNC share has no portable coordinate relative
// to the project. It records a precise error; NewDump returns that error before
// a caller can serialize the partial projection.
func (m *dumpPathMapper) mapPath(file string) string {
  if file == "" {
    return ""
  }
  normalized := shimtspath.NormalizeSlashes(file)
  if strings.HasPrefix(normalized, "bundled:///") {
    return m.claim(normalized, normalized)
  }
  normalized = shimtspath.NormalizePath(normalized)
  if m.project == "" || shimtspath.GetRootLength(m.project) == 0 {
    return normalized
  }

  // A relative compiler path is relative to the project the caller named, so
  // absolutize it against the raw spelling before collapsing aliases.
  rawPhysical := normalized
  if shimtspath.GetRootLength(rawPhysical) == 0 {
    rawPhysical = shimtspath.GetNormalizedAbsolutePath(rawPhysical, m.rawProject)
  }
  // One source rides the wire once per node, once per node id and twice per
  // edge endpoint. Cache before canonicalization so a large graph pays the
  // filesystem walk once per distinct raw path instead of once per fact.
  rawKey := m.pathKey(rawPhysical)
  if wire, ok := m.rawToWire[rawKey]; ok {
    return wire
  }
  physical := m.canonicalize(rawPhysical)
  if !dumpPathRootsEqual(m.project, physical, m.caseSensitive) {
    m.fail(fmt.Errorf(
      "ttscgraph: source path %q cannot be represented relative to project %q because they are on different filesystem roots",
      rawPhysical,
      m.project,
    ))
    return rawPhysical
  }
  options := shimtspath.ComparePathsOptions{
    CurrentDirectory:          m.project,
    UseCaseSensitiveFileNames: m.caseSensitive,
  }
  wire := shimtspath.GetRelativePathFromDirectory(m.project, physical, options)
  if shimtspath.GetRootLength(wire) != 0 {
    m.fail(fmt.Errorf(
      "ttscgraph: source path %q cannot be represented relative to project %q because they are on different filesystem roots",
      rawPhysical,
      m.project,
    ))
    return rawPhysical
  }
  wire = m.claim(physical, wire)
  m.rawToWire[rawKey] = wire
  return wire
}

func (m *dumpPathMapper) pathKey(path string) string {
  if !m.caseSensitive {
    return strings.ToLower(path)
  }
  return path
}

// canonicalDumpPath collapses host filesystem aliases before the portable path
// grammar is applied. On macOS one temporary project is observable as both
// /var/... and /private/var/...; on Windows the same directory answers to an
// 8.3 short spelling and its expanded name. Comparing those raw strings would
// make an in-project source look like a sibling outside the project root.
//
// Resolution is anchored on the longest existing ancestor rather than the leaf.
// A source the compiler names before it exists on disk — a `rootDirs` target, a
// deleted-and-revisited file, a path the checker resolved through a container
// that was removed — must still land on the same canonical base as its
// neighbours; resolving only complete paths would leave exactly those inputs
// spelled through the alias and reproduce the misprojection for them.
//
// Synthetic Windows and UNC fixtures in the mapper's own unit tests are not
// host paths at all, so they keep their lexical spelling and continue to prove
// the cross-root and injectivity rules on every CI host.
func canonicalDumpPath(location string) string {
  normalized := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(location))
  if normalized == "" || shimtspath.GetRootLength(normalized) == 0 {
    return normalized
  }
  if !dumpPathUsesHostFilesystem(normalized) {
    return normalized
  }
  candidate := filepath.Clean(filepath.FromSlash(normalized))
  suffix := []string{}
  for {
    physical, err := filepath.EvalSymlinks(candidate)
    if err == nil {
      for index := len(suffix) - 1; index >= 0; index-- {
        physical = filepath.Join(physical, suffix[index])
      }
      return shimtspath.NormalizePath(shimtspath.NormalizeSlashes(physical))
    }
    parent := filepath.Dir(candidate)
    if parent == candidate {
      break
    }
    suffix = append(suffix, filepath.Base(candidate))
    candidate = parent
  }
  return normalized
}

// dumpPathUsesHostFilesystem separates a real path on this host from a
// synthetic path that only exercises another platform's grammar. A POSIX host
// never owns `C:/...` or `//server/share/...`, and a Windows host never owns a
// single-slash absolute path, so neither should reach the filesystem.
func dumpPathUsesHostFilesystem(path string) bool {
  if runtime.GOOS == "windows" {
    return strings.HasPrefix(path, "//") || (len(path) >= 2 && path[1] == ':')
  }
  return strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "//")
}

// claim records both directions of the projection. The reverse map is the
// injectivity gate: two distinct compiler sources may never acquire one wire
// identity, even if a future coordinate rule is added incorrectly.
func (m *dumpPathMapper) claim(physical, wire string) string {
  key := physical
  if !m.caseSensitive && !strings.HasPrefix(physical, "bundled:///") {
    key = strings.ToLower(key)
  }
  if previous, ok := m.physicalToWire[key]; ok {
    if previous != wire {
      m.fail(fmt.Errorf(
        "ttscgraph: source path %q mapped inconsistently to %q and %q",
        physical,
        previous,
        wire,
      ))
    }
    return previous
  }
  if previous, ok := m.wireToPhysical[wire]; ok && previous != key {
    m.fail(fmt.Errorf(
      "ttscgraph: source paths %q and %q collide at wire identity %q",
      previous,
      physical,
      wire,
    ))
    return wire
  }
  m.physicalToWire[key] = wire
  m.wireToPhysical[wire] = key
  return wire
}

func (m *dumpPathMapper) fail(err error) {
  if m.mappingErr == nil {
    m.mappingErr = err
  }
}

func (m *dumpPathMapper) err() error { return m.mappingErr }

// Windows drive and UNC roots use case-insensitive path comparison. POSIX
// roots remain case-sensitive. This decision follows the path's own grammar so
// synthetic Windows/UNC fixtures behave the same on every CI host.
func dumpPathRootIsCaseSensitive(path string) bool {
  rootLength := shimtspath.GetRootLength(path)
  if rootLength == 0 {
    return true
  }
  root := path[:rootLength]
  return !(strings.HasPrefix(root, "//") || (len(root) >= 2 && root[1] == ':'))
}

// dumpPathRootsEqual compares filesystem roots before asking tspath for a
// relative coordinate. tspath models a UNC root as `//server/`, which is useful
// for URL-like path operations but too broad for a filesystem identity: on
// Windows, `//server/share-a` and `//server/share-b` are different volumes and
// no `../share-b` coordinate can cross between them. Include the share component
// for that one grammar and keep tspath's roots for drive and POSIX paths.
func dumpPathRootsEqual(left, right string, caseSensitive bool) bool {
  leftRoot := dumpFilesystemRoot(left)
  rightRoot := dumpFilesystemRoot(right)
  if caseSensitive {
    return leftRoot == rightRoot
  }
  return strings.EqualFold(leftRoot, rightRoot)
}

func dumpFilesystemRoot(path string) string {
  normalized := shimtspath.NormalizeSlashes(path)
  rootLength := shimtspath.GetRootLength(normalized)
  if rootLength == 0 {
    return ""
  }
  root := normalized[:rootLength]
  if !strings.HasPrefix(root, "//") {
    return root
  }
  remainder := normalized[rootLength:]
  if slash := strings.IndexByte(remainder, '/'); slash >= 0 {
    return root + remainder[:slash]
  }
  return root + remainder
}
