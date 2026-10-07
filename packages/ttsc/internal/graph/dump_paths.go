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

// WireProject returns the best-effort canonical base used for every relative
// wire path emitted by this package.
// The optional policy is the producing Program's UseCaseSensitiveFileNames;
// without a producer, paths retain exact spelling rather than guessing from
// drive, UNC or POSIX syntax. Supply at most one policy value.
//
// @evidence contracts/common.md#principled-implementation The shared mapper checks absolute root syntax and policy arity before publishing a best-effort base; missing or unresolved native paths can retain lexical spelling, without physical identity authentication.
// @evidence contracts/common.md#clear-and-simple-design A narrow adapter delegates all path policy to one mapper constructor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid roots remain errors rather than receiving a fixture-specific fallback base.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the canonical base shared by relative wire paths, with documentation-skill tag spacing.
// @evidence contracts/portability.md#os-neutral-implementation Host-compatible paths use best-effort EvalSymlinks and ancestor fallback. Supplied compiler case policy controls comparison, not authentication of physical spelling or per-directory filesystem behavior.
// @evidence contracts/performance.md#efficient-algorithms Work includes project normalization and native EvalSymlinks attempts up the ancestor chain, plus suffix reconstruction and fixed map setup. Path bytes, depth and native resolution work contribute; it is not one native query.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This single-base adapter owns no repeated mapping consumers; callers projecting many paths retain one mapper.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call-local mapper owns no historical cache or handle; its temporary native/path storage becomes unreachable while the returned coordinate transfers to the caller.
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
// @evidence contracts/portability.md#os-neutral-implementation Host-compatible paths attempt native alias resolution, falling back to existing ancestors or lexical spelling. Supplied compiler case policy, or exact spelling without it, is not a per-directory case or snapshot proof.
// @evidence contracts/performance.md#efficient-algorithms Project and selected-path normalization, native ancestor resolution, relative projection and string-key hashing/comparison contribute. Depth and symlink/native work are not bounded by two string lengths alone.
// @evidence contracts/performance.md#reuse-equivalent-work Within this projection, mapper keys reuse successful normalized/policy-folded raw projections and physical claims. Separate aliases can require new native resolution; wider collision detection requires a shared mapper and stable caller inputs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call-local mapper/path maps become unreachable; returned path strings transfer to the caller. No historical cache or native handle is retained by this adapter.
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
// @evidence contracts/common.md#principled-implementation The parser maps the declaration path and module-name path component, preserving other decoded symbol names and kind strings. It checks grammar separators, not vocabulary or producer authenticity.
// @evidence contracts/common.md#clear-and-simple-design The single-ID adapter delegates to the batch mapper, sharing its grammar and error semantics.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing separators or empty name/kind suffixes return codec errors, while arbitrary nonempty kind strings are not validated here. No fixture-specific endpoint is substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose explains native-cache versus wire-store identity reconciliation, with documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation The shared best-effort mapper retains native ancestor/lexical fallback limits and supplied case policy; protocol parsing does not authenticate filesystem aliases or freeze a snapshot.
// @evidence contracts/performance.md#efficient-algorithms ID decoding/re-encoding and map string keys add byte costs to project/path normalization and native ancestor-resolution attempts. Work is independent of graph population, not native depth or symlink traversal.
// @evidence contracts/performance.md#reuse-equivalent-work It shares the same batch implementation and mapper-local alias cache; no output is reused across unrelated snapshots.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The local batch/mapper storage becomes unreachable and one returned ID string transfers to the caller. No historical cache or native handle is owned; temporary bytes follow ID/path inputs.
func WireNodeID(project, id string, caseSensitive ...bool) (string, error) {
  ids, err := WireNodeIDs(project, []string{id}, caseSensitive...)
  return ids[id], err
}

// WireNodeIDs maps a set of internal node IDs through one path mapper. Sharing
// the mapper preserves policy-relative collision detection and reuses each repeated
// successful raw-path projection within this call, without freezing native aliases.
// The optional case policy follows WireProject's producer-owned convention.
//
// @evidence contracts/common.md#principled-implementation All IDs share detected path-collision checks under supplied case policy and best-effort canonical spelling. Policy-folded or unresolved paths are not independent physical identities, and input stability remains the caller's responsibility.
// @evidence contracts/common.md#clear-and-simple-design One loop composes the node grammar with the reusable path boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed grammar returns nil/error immediately; cross-root or collision errors are latched and returned after the loop, potentially with an output map. Callers must reject errored projections rather than use partial coordinates.
// @evidence contracts/common.md#meaningful-documentation Native prose states shared collision detection and generation-local alias resolution, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Filesystem-bearing components use protocol slashes and host-compatible best-effort native resolution; supplied compiler case policy is not proof of each directory's physical identity.
// @evidence contracts/performance.md#efficient-algorithms Aggregate ID decoding/re-encoding, string-key hashing/comparison and project/path projection costs include native ancestor attempts and symlink work. Repeated successful raw keys reuse mapping; distinct aliases can still require separate native queries.
// @evidence contracts/performance.md#reuse-equivalent-work Repeated successful raw keys reuse results within this call; physical aliases still require their own canonicalization before a shared claim is found. Each invocation creates a new mapper, not a stable filesystem snapshot.
// @evidence contracts/performance.md#bound-retention-and-release-resources Uncapped raw/physical/wire caches and output strings grow with batch path populations and byte lengths. Local maps become unreachable on return; successful output transfers to the caller, and detected mapping error can accompany an output map. No historical eviction policy or native handle is owned.
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
