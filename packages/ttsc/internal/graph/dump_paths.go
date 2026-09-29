package graph

import (
  "fmt"
  "path/filepath"
  "runtime"
  "strings"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// dumpPathMapper owns the dump path vocabulary for one dump. Every
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

func newDumpPathMapper(project string, caseSensitive ...bool) *dumpPathMapper {
  sensitive := true
  if len(caseSensitive) != 0 {
    sensitive = caseSensitive[0]
  }
  raw := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(project))
  normalized := canonicalDumpPath(raw)
  mapper := &dumpPathMapper{
    rawProject:     raw,
    project:        normalized,
    caseSensitive:  sensitive,
    canonicalize:   canonicalDumpPath,
    rawToWire:      map[string]string{},
    physicalToWire: map[string]string{},
    wireToPhysical: map[string]string{},
  }
  if normalized == "" || shimtspath.GetRootLength(normalized) == 0 {
    mapper.mappingErr = fmt.Errorf("ttscgraph: project root %q is not absolute", project)
  } else if len(caseSensitive) > 1 {
    mapper.mappingErr = fmt.Errorf("ttscgraph: path projection accepts at most one case policy")
  }
  return mapper
}

// WireProject returns the canonical filesystem base that owns every relative
// wire path emitted by this package.
// The optional policy is the producing Program's UseCaseSensitiveFileNames;
// without a producer, paths retain exact spelling rather than guessing from
// drive, UNC or POSIX syntax. Supply at most one policy value.
//
// @evidence contracts/common.md#principled-implementation The same canonical project coordinate used by dumps validates absolute-root identity before callers publish the base.
// @evidence contracts/common.md#clear-and-simple-design A narrow adapter delegates all path policy to one mapper constructor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid roots remain errors rather than receiving a fixture-specific fallback base.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the canonical base shared by relative wire paths, with documentation-skill tag spacing.
// @evidence contracts/portability.md#os-neutral-implementation Native alias resolution uses EvalSymlinks; caller-supplied compiler case policy replaces assumptions from drive, UNC or POSIX spelling.
// @evidence contracts/performance.md#efficient-algorithms Work follows project-path length and one native canonicalization, with fixed mapper setup.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This single-base adapter owns no repeated mapping consumers; callers projecting many paths retain one mapper.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The mapper is local and retains no state after returning its coordinate.
func WireProject(project string, caseSensitive ...bool) (string, error) {
  mapper := newDumpPathMapper(project, caseSensitive...)
  return mapper.project, mapper.err()
}

// WirePath maps one compiler path into the portable dump vocabulary used
// by dumps and resident graph shards. Callers that project a complete graph
// keep one dumpPathMapper so collision detection spans every path; callers
// shaping a single source/config coordinate use this helper and receive the
// same filesystem-alias and cross-root behavior.
// The optional case policy follows WireProject's producer-owned convention.
//
// @evidence contracts/common.md#principled-implementation One source/config coordinate uses the complete dump's alias resolution and cross-root checks.
// @evidence contracts/common.md#clear-and-simple-design The mapper owns all identity policy; this adapter returns one coordinate and its accumulated error.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Paths on another native root fail rather than collapsing to a misleading package tail or guessed relative identity.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes single-coordinate callers from whole-graph collision ownership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native aliases are canonicalized before portable mapping, using the producing compiler's supplied case policy or exact spelling when no producer is supplied.
// @evidence contracts/performance.md#efficient-algorithms Cost follows the two path lengths and native canonicalization, with constant expected lookup overhead.
// @evidence contracts/performance.md#reuse-equivalent-work Within this projection, raw and physical path maps reuse equivalent alias work; cross-coordinate collision detection requires the documented shared-mapper caller.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The one-call mapper is discarded and no handle or historical cache is retained.
func WirePath(project, file string, caseSensitive ...bool) (string, error) {
  mapper := newDumpPathMapper(project, caseSensitive...)
  wire := mapper.mapPath(file)
  return wire, mapper.err()
}

// WireNodeID maps the filesystem-bearing portions of one internal node ID into
// the same portable vocabulary as NewDumpFacts. Resident stores use it when a
// wire-level external reference count must be reconciled with the immutable
// graph.Node cache, whose keys retain compiler-physical paths.
// The optional case policy follows WireProject's producer-owned convention.
//
// @evidence contracts/common.md#principled-implementation Escaped node-ID parsing maps only native path components while keeping symbol names and kinds unchanged.
// @evidence contracts/common.md#clear-and-simple-design The single-ID adapter delegates to the batch mapper, sharing its grammar and error semantics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid IDs return codec errors instead of guessed separators or fixture-specific names.
// @evidence contracts/common.md#meaningful-documentation Native prose explains native-cache versus wire-store identity reconciliation, with documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation The shared mapper supplies portable coordinates and native alias checks under the supplied compiler case policy, without inferring filesystem behavior from OS path syntax.
// @evidence contracts/performance.md#efficient-algorithms Work scales with ID/path byte length and native canonicalization, not graph size.
// @evidence contracts/performance.md#reuse-equivalent-work It shares the same batch implementation and mapper-local alias cache; no output is reused across unrelated snapshots.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The local output map transfers no retained cache ownership to this function.
func WireNodeID(project, id string, caseSensitive ...bool) (string, error) {
  ids, err := WireNodeIDs(project, []string{id}, caseSensitive...)
  return ids[id], err
}

// WireNodeIDs maps a set of internal node IDs through one path mapper. Sharing
// the mapper preserves cross-ID collision detection and resolves each repeated
// filesystem alias only once per snapshot generation.
// The optional case policy follows WireProject's producer-owned convention.
//
// @evidence contracts/common.md#principled-implementation All IDs share one injective path mapper, so aliases agree and distinct physical identities cannot silently collapse within the batch.
// @evidence contracts/common.md#clear-and-simple-design One loop composes the node grammar with the reusable path boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cross-root, invalid-ID and collision errors abort the batch without omitting inconvenient endpoints.
// @evidence contracts/common.md#meaningful-documentation Native prose states shared collision detection and generation-local alias resolution, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Filesystem-bearing ID components use native alias resolution and protocol slashes; the owning compiler supplies case identity instead of OS-name or root-grammar guesses.
// @evidence contracts/performance.md#efficient-algorithms Work is linear in aggregate ID bytes plus canonicalization of unique path spellings, with expected constant-time map access.
// @evidence contracts/performance.md#reuse-equivalent-work Repeated raw paths and physical aliases reuse mapper results within this batch; a new generation receives a new mapper.
// @evidence contracts/performance.md#bound-retention-and-release-resources Mapper caches are batch-local and released on success or error; only the returned ID map transfers to the caller.
func WireNodeIDs(project string, ids []string, caseSensitive ...bool) (map[string]string, error) {
  mapper := newDumpPathMapper(project, caseSensitive...)
  wireIDs := make(map[string]string, len(ids))
  for _, id := range ids {
    wire, err := wireNodeID(mapper, id)
    if err != nil {
      return nil, err
    }
    wireIDs[id] = wire
  }
  return wireIDs, mapper.err()
}

func wireNodeID(mapper *dumpPathMapper, id string) (string, error) {
  parts, ok := parseNodeID(id)
  if !ok {
    return "", fmt.Errorf("ttscgraph: invalid internal graph node id %q", id)
  }
  name := parts.name
  if parts.kind == NodeModule {
    name = mapper.mapPath(name)
  }
  wire := nodeID(mapper.mapPath(parts.path), name, parts.kind)
  return wire, nil
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
  normalized := shimtspath.NormalizePath(shimtspath.NormalizeSlashes(file))
  if strings.HasPrefix(normalized, "bundled:///") {
    return m.claim(normalized, normalized)
  }
  if m.project == "" || shimtspath.GetRootLength(m.project) == 0 {
    return normalized
  }

  rawPhysical := normalized
  if shimtspath.GetRootLength(rawPhysical) == 0 {
    rawPhysical = shimtspath.GetNormalizedAbsolutePath(rawPhysical, m.rawProject)
  }
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

func dumpPathUsesHostFilesystem(path string) bool {
  if runtime.GOOS == "windows" {
    return strings.HasPrefix(path, "//") || (len(path) >= 2 && path[1] == ':')
  }
  return strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "//")
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
