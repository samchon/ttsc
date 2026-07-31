package graph

import (
  "fmt"
  "path/filepath"
  "strings"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// dumpPathMapper owns the schema-v6 path vocabulary for one dump. Every
// identity-bearing path passes through this one cache, so the producer can
// reject both an unportable filesystem root and a non-injective projection
// before any JSON is written.
type dumpPathMapper struct {
  project       string
  caseSensitive bool

  physicalToWire map[string]string
  wireToPhysical map[string]string
  mappingErr     error
}

func newDumpPathMapper(project string) *dumpPathMapper {
  normalized := canonicalDumpPath(project)
  mapper := &dumpPathMapper{
    project:        normalized,
    caseSensitive:  dumpPathRootIsCaseSensitive(normalized),
    physicalToWire: map[string]string{},
    wireToPhysical: map[string]string{},
  }
  if normalized == "" || shimtspath.GetRootLength(normalized) == 0 {
    mapper.mappingErr = fmt.Errorf("ttscgraph: project root %q is not absolute", project)
  }
  return mapper
}

// WirePath maps one compiler path into the portable schema-v6 vocabulary used
// by dumps and resident graph shards. Callers that project a complete graph
// keep one dumpPathMapper so collision detection spans every path; callers
// shaping a single source/config coordinate use this helper and receive the
// same filesystem-alias and cross-root behavior.
func WirePath(project, file string) (string, error) {
  mapper := newDumpPathMapper(project)
  wire := mapper.mapPath(file)
  return wire, mapper.err()
}

// WireNodeID maps the filesystem-bearing portions of one internal node ID into
// the same portable vocabulary as NewDumpFacts. Resident stores use it when a
// wire-level external reference count must be reconciled with the immutable
// graph.Node cache, whose keys retain compiler-physical paths.
func WireNodeID(project, id string) (string, error) {
  parts, ok := parseNodeID(id)
  if !ok {
    return "", fmt.Errorf("ttscgraph: invalid internal graph node id %q", id)
  }
  mapper := newDumpPathMapper(project)
  name := parts.name
  if parts.kind == NodeModule {
    name = mapper.mapPath(name)
  }
  wire := nodeID(mapper.mapPath(parts.path), name, parts.kind)
  return wire, mapper.err()
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
  normalized = canonicalDumpPath(normalized)
  if m.project == "" || shimtspath.GetRootLength(m.project) == 0 {
    return normalized
  }

  physical := normalized
  if shimtspath.GetRootLength(physical) == 0 {
    physical = shimtspath.GetNormalizedAbsolutePath(physical, m.project)
  }
  if !dumpPathRootsEqual(m.project, physical, m.caseSensitive) {
    m.fail(fmt.Errorf(
      "ttscgraph: source path %q cannot be represented relative to project %q because they are on different filesystem roots",
      normalized,
      m.project,
    ))
    return normalized
  }
  options := shimtspath.ComparePathsOptions{
    CurrentDirectory:          m.project,
    UseCaseSensitiveFileNames: m.caseSensitive,
  }
  wire := shimtspath.GetRelativePathFromDirectory(m.project, physical, options)
  if shimtspath.GetRootLength(wire) != 0 {
    m.fail(fmt.Errorf(
      "ttscgraph: source path %q cannot be represented relative to project %q because they are on different filesystem roots",
      normalized,
      m.project,
    ))
    return normalized
  }
  return m.claim(physical, wire)
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

// canonicalDumpPath collapses filesystem aliases for an existing path before
// it enters the wire-coordinate mapper. TypeScript reports physical source
// names, while a caller may select the same project through a symlink or a
// Windows 8.3 spelling; comparing those raw strings would leak a producer-local
// absolute path into an otherwise portable snapshot.
//
// Synthetic paths in mapper unit tests and missing paths retain their lexical
// spelling. Real graph inputs exist by construction, so the best-effort branch
// covers their physical identity without weakening the mapper's explicit
// cross-root and collision checks.
func canonicalDumpPath(location string) string {
  normalized := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(location))
  if normalized == "" || shimtspath.GetRootLength(normalized) == 0 {
    return normalized
  }
  physical, err := filepath.EvalSymlinks(filepath.FromSlash(normalized))
  if err != nil {
    return normalized
  }
  return shimtspath.NormalizePath(shimtspath.NormalizeSlashes(physical))
}

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
