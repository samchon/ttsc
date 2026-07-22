package graph

import (
  "fmt"
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
  normalized := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(project))
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

  physical := normalized
  if shimtspath.GetRootLength(physical) == 0 {
    physical = shimtspath.GetNormalizedAbsolutePath(physical, m.project)
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
