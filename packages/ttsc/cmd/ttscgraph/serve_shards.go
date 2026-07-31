package main

import (
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "maps"
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

const graphSnapshotProtocolVersion = 1

// serveGraphSnapshot is one atomic native shard transaction. Manifest is the
// complete committed generation; Upserts and Deletes are the delta from
// BaseGeneration. The consumer validates and normalizes it into its own Graph
// Snapshot Protocol before publication.
type serveGraphSnapshot struct {
  ProtocolVersion int                        `json:"protocolVersion"`
  SchemaVersion   int                        `json:"schemaVersion"`
  Project         string                     `json:"project"`
  Tsconfig        string                     `json:"tsconfig"`
  Producer        graph.Producer             `json:"producer"`
  Capabilities    []string                   `json:"capabilities"`
  Universe        graph.Universe             `json:"universe"`
  Sequence        int                        `json:"sequence"`
  Generation      string                     `json:"generation"`
  BaseSequence    int                        `json:"baseSequence,omitempty"`
  BaseGeneration  string                     `json:"baseGeneration,omitempty"`
  Upserts         []serveGraphShardUpsert    `json:"upserts"`
  Deletes         []string                   `json:"deletes"`
  Manifest        []serveGraphShardReference `json:"manifest"`
}

type serveGraphShardUpsert struct {
  Digest string          `json:"digest"`
  Shard  serveGraphShard `json:"shard"`
}

type serveGraphShardReference struct {
  Key    string `json:"key"`
  Digest string `json:"digest"`
}

// serveGraphShard owns one compiler source's outgoing facts or one config
// input. Source and Config are both absent only on the external-node and
// fileless-diagnostic metadata shards.
type serveGraphShard struct {
  Key         string              `json:"key"`
  Source      *graph.SourceDigest `json:"source,omitempty"`
  Config      *graph.FileDigest   `json:"config,omitempty"`
  Nodes       []graph.DumpNode    `json:"nodes"`
  Edges       []graph.DumpEdge    `json:"edges"`
  Diagnostics []graph.Diagnostic  `json:"diagnostics"`
}

type committedServeGraphShard struct {
  digest string
  shard  serveGraphShard
}

type serveGraphStore struct {
  sequence              int
  generation            string
  shards                map[string]committedServeGraphShard
  nodes                 map[string]*graph.Node
  provenance            graph.Provenance
  wireProvenance        graph.Provenance
  wireSources           map[string]string
  identity              serveGraphIdentity
  resolutionDigests     map[string]string
  sourceKeys            map[string]string
  dumpNodeFiles         map[string]string
  reverseDependencies   map[string][]string
  sourceExternal        map[string]map[string]bool
  externalNodes         map[string]graph.DumpNode
  externalReferences    map[string]int
  externalNodeWireIDs   map[string]string
  implementationSources map[string]map[string]bool
  nodeOwners            map[string]string
  incomingEdges         map[string]map[string]int
  // extractedFiles records the exact authored closure read for this generation.
  // It supports phase/closure evidence without retaining an older generation.
  extractedFiles []string
}

type serveGraphIdentity struct {
  project  string
  target   string
  universe string
  producer graph.Producer
}

func (s *graphSession) SnapshotShards() (*serveGraphSnapshot, string, bool, error) {
  change, err := s.nextChange(true)
  if err != nil {
    return nil, "", false, err
  }
  if change == nil {
    return nil, serveModeUnchanged, false, nil
  }

  snapshot, store, err := s.buildShardSnapshot(change)
  if err != nil {
    s.pending = change
    return nil, "", false, err
  }
  s.graphStore = store
  s.pending = nil
  return snapshot, change.mode, true, nil
}

func (s *graphSession) buildShardSnapshot(change *graphChange) (*serveGraphSnapshot, *serveGraphStore, error) {
  if change.full || s.graphStore == nil {
    return s.buildFullShardSnapshot()
  }
  return s.buildIncrementalShardSnapshot(change.files, change.publicFiles)
}

func (s *graphSession) buildFullShardSnapshot() (*serveGraphSnapshot, *serveGraphStore, error) {
  program := s.compiler.Program()
  built := graph.Build(program)
  texts := graph.SourceTexts(program)
  provenance := graph.NewProvenance(
    serveProducer(),
    fullSnapshotCapabilities,
    s.configDigests,
    s.roots,
    texts,
    s.diskDigests,
  )
  identity, wireProvenance, wireSources, err := newServeGraphIdentity(s.cwd, s.tsconfig, provenance)
  if err != nil {
    return nil, nil, err
  }
  facts, err := graph.NewDumpFacts(
    built,
    s.cwd,
    graph.GitIgnoredFiles(s.cwd, built),
    texts,
  )
  if err != nil {
    return nil, nil, err
  }
  resolutionDigests, err := serveGraphResolutionDigests(program, s.cwd)
  if err != nil {
    return nil, nil, err
  }
  shards, sourceKeys, dumpNodeFiles, externalNodes, sourceExternal, err := partitionServeGraphFacts(
    identity,
    provenance,
    facts,
    graph.NewDiagnostics(program),
    nil,
    nil,
    resolutionDigests,
  )
  if err != nil {
    return nil, nil, err
  }
  externalReferences := map[string]int{}
  for _, targets := range sourceExternal {
    for id := range targets {
      externalReferences[id]++
    }
  }
  if err := installExternalShard(shards, identity, externalNodes, externalReferences); err != nil {
    return nil, nil, err
  }
  externalNodeWireIDs, err := serveGraphExternalNodeWireIDs(s.cwd, built.Nodes)
  if err != nil {
    return nil, nil, err
  }
  store := &serveGraphStore{
    shards:                map[string]committedServeGraphShard{},
    nodes:                 maps.Clone(built.Nodes),
    provenance:            provenance,
    wireProvenance:        wireProvenance,
    wireSources:           wireSources,
    identity:              identity,
    resolutionDigests:     resolutionDigests,
    sourceKeys:            sourceKeys,
    dumpNodeFiles:         dumpNodeFiles,
    reverseDependencies:   reverseGraphDependencies(program),
    sourceExternal:        sourceExternal,
    externalNodes:         externalNodes,
    externalReferences:    externalReferences,
    externalNodeWireIDs:   externalNodeWireIDs,
    implementationSources: cloneServeGraphStringSets(built.ImplementationSources),
    extractedFiles:        sortedSelectedFiles(authoredGraphFiles(program)),
  }
  snapshot, committed, nodeOwners, incomingEdges, err := commitServeGraphSnapshot(
    identity,
    wireProvenance,
    s.graphStore,
    shards,
    nil,
    true,
  )
  if err != nil {
    return nil, nil, err
  }
  store.sequence = snapshot.Sequence
  store.generation = snapshot.Generation
  store.shards = committed
  store.nodeOwners = nodeOwners
  store.incomingEdges = incomingEdges
  return snapshot, store, nil
}

func (s *graphSession) buildIncrementalShardSnapshot(changed, publicChanged []string) (*serveGraphSnapshot, *serveGraphStore, error) {
  prior := s.graphStore
  program := s.compiler.Program()
  selected := invalidatedGraphFiles(program, prior.reverseDependencies, changed, publicChanged)
  if len(selected) == 0 {
    // A changed declaration or virtual input outside the authored graph can
    // alter external endpoints and global types. Rebuild when no exact source
    // owner can be established instead of publishing an empty semantic delta.
    return s.buildFullShardSnapshot()
  }

  // Re-export edges can stamp a declaration owned by a forward dependency.
  // Include both the prior and next targets in the same replacement set, then
  // rebuild once more so every selected declaration is fresh before commit.
  addPriorExportTargets(selected, prior)
  expandPriorImplementationSources(selected, prior)
  var partial *graph.Graph
  for {
    files := sortedSelectedFiles(selected)
    partial = graph.BuildFiles(program, files, prior.nodes)
    expanded := false
    for id := range partial.ExportedTargets {
      file := graph.NodeFile(id)
      if file != "" && !selected[file] && graphSourceFile(program, file) != nil {
        selected[file] = true
        expanded = true
      }
    }
    for id := range partial.ImplementationSources {
      file := graph.NodeFile(id)
      if file != "" && !selected[file] && graphSourceFile(program, file) != nil {
        selected[file] = true
        expanded = true
      }
    }
    if !expanded {
      break
    }
    expandPriorImplementationSources(selected, prior)
  }

  projectionFiles := maps.Clone(selected)
  for _, node := range partial.Nodes {
    projectionFiles[node.File] = true
    if node.ImplementationFile != "" {
      projectionFiles[node.ImplementationFile] = true
    }
  }
  for _, sources := range partial.ImplementationSources {
    for file := range sources {
      projectionFiles[file] = true
    }
  }
  texts := graph.SourceTextsForFiles(program, sortedSelectedFiles(projectionFiles))
  provenance, wireProvenance, ok := advanceServeGraphProvenance(
    prior.provenance,
    prior.wireProvenance,
    prior.wireSources,
    program,
    changed,
    s.diskDigests,
  )
  if !ok {
    return s.buildFullShardSnapshot()
  }
  identity := prior.identity
  facts, err := graph.NewDumpFacts(
    partial,
    s.cwd,
    graph.GitIgnoredFiles(s.cwd, partial),
    texts,
  )
  if err != nil {
    return nil, nil, err
  }
  selectedFiles := sortedSelectedFiles(selected)
  selectedSources := make([]*shimast.SourceFile, 0, len(selectedFiles))
  for _, file := range selectedFiles {
    source := graphSourceFile(program, file)
    if source == nil {
      return s.buildFullShardSnapshot()
    }
    selectedSources = append(selectedSources, source)
  }
  replacements, replacementSourceKeys, replacementDumpNodeFiles, discoveredExternal, replacementExternal, err := partitionServeGraphFacts(
    identity,
    provenance,
    facts,
    graph.NewDiagnosticsForFiles(program, selectedSources),
    selected,
    prior.externalNodes,
    prior.resolutionDigests,
  )
  if err != nil {
    return nil, nil, err
  }

  nextShards := maps.Clone(prior.shards)
  nextSourceExternal := maps.Clone(prior.sourceExternal)
  nextExternalNodes := maps.Clone(prior.externalNodes)
  nextExternalReferences := maps.Clone(prior.externalReferences)
  nextSourceKeys := maps.Clone(prior.sourceKeys)
  nextDumpNodeFiles := maps.Clone(prior.dumpNodeFiles)
  for file := range selected {
    key := nextSourceKeys[file]
    if old := nextSourceExternal[key]; old != nil {
      for id := range old {
        nextExternalReferences[id]--
      }
    }
    delete(nextSourceExternal, key)
    delete(nextShards, key)
    delete(nextSourceKeys, file)
  }
  for id, file := range nextDumpNodeFiles {
    if selected[file] {
      delete(nextDumpNodeFiles, id)
    }
  }
  for file, key := range replacementSourceKeys {
    nextSourceKeys[file] = key
  }
  for id, file := range replacementDumpNodeFiles {
    nextDumpNodeFiles[id] = file
  }
  for key, targets := range replacementExternal {
    nextSourceExternal[key] = targets
    for id := range targets {
      nextExternalReferences[id]++
      if node, ok := discoveredExternal[id]; ok {
        nextExternalNodes[id] = node
      } else if node, ok := prior.externalNodes[id]; ok {
        nextExternalNodes[id] = node
      }
    }
  }
  for id, count := range nextExternalReferences {
    if count <= 0 {
      delete(nextExternalReferences, id)
      delete(nextExternalNodes, id)
    }
  }

  nextRaw := rawServeShards(nextShards)
  for key, shard := range replacements {
    nextRaw[key] = shard
  }
  if err := installExternalShard(nextRaw, identity, nextExternalNodes, nextExternalReferences); err != nil {
    return nil, nil, err
  }
  dirty := make(map[string]bool, len(replacements)+1)
  for key := range replacements {
    dirty[key] = true
  }
  dirty[externalServeGraphShardKey(identity)] = true

  nextNodes := maps.Clone(prior.nodes)
  for id, node := range nextNodes {
    if selected[node.File] {
      delete(nextNodes, id)
    }
  }

  nextImplementationSources := cloneServeGraphStringSets(prior.implementationSources)
  for id := range nextImplementationSources {
    if selected[graph.NodeFile(id)] {
      delete(nextImplementationSources, id)
    }
  }
  for id, sources := range partial.ImplementationSources {
    nextImplementationSources[id] = maps.Clone(sources)
  }
  for id, node := range partial.Nodes {
    nextNodes[id] = node
  }
  nextExternalNodeWireIDs := maps.Clone(prior.externalNodeWireIDs)
  changedExternalNodeWireIDs, err := serveGraphExternalNodeWireIDs(s.cwd, partial.Nodes)
  if err != nil {
    return nil, nil, err
  }
  for id, wireID := range changedExternalNodeWireIDs {
    nextExternalNodeWireIDs[id] = wireID
  }
  for id, node := range nextNodes {
    if node.External {
      wireID, exists := nextExternalNodeWireIDs[id]
      if !exists {
        return nil, nil, fmt.Errorf("ttscgraph: external node %s has no wire identity", id)
      }
      if nextExternalReferences[wireID] <= 0 {
        delete(nextNodes, id)
        delete(nextExternalNodeWireIDs, id)
      }
    }
  }

  snapshot, committed, nodeOwners, incomingEdges, err := commitServeGraphSnapshot(
    identity,
    wireProvenance,
    prior,
    nextRaw,
    dirty,
    false,
  )
  if err != nil {
    return nil, nil, err
  }
  store := &serveGraphStore{
    sequence:              snapshot.Sequence,
    generation:            snapshot.Generation,
    shards:                committed,
    nodes:                 nextNodes,
    provenance:            provenance,
    wireProvenance:        wireProvenance,
    wireSources:           maps.Clone(prior.wireSources),
    identity:              identity,
    resolutionDigests:     prior.resolutionDigests,
    sourceKeys:            nextSourceKeys,
    dumpNodeFiles:         nextDumpNodeFiles,
    reverseDependencies:   prior.reverseDependencies,
    sourceExternal:        nextSourceExternal,
    externalNodes:         nextExternalNodes,
    externalReferences:    nextExternalReferences,
    externalNodeWireIDs:   nextExternalNodeWireIDs,
    implementationSources: nextImplementationSources,
    nodeOwners:            nodeOwners,
    incomingEdges:         incomingEdges,
    extractedFiles:        append([]string{}, selectedFiles...),
  }
  return snapshot, store, nil
}

func commitServeGraphSnapshot(
  identity serveGraphIdentity,
  provenance graph.Provenance,
  prior *serveGraphStore,
  shards map[string]serveGraphShard,
  dirty map[string]bool,
  forceAll bool,
) (*serveGraphSnapshot, map[string]committedServeGraphShard, map[string]string, map[string]map[string]int, error) {
  manifest := make([]serveGraphShardReference, 0, len(shards))
  current := make(map[string]committedServeGraphShard, len(shards))
  keys := make([]string, 0, len(shards))
  for key := range shards {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  for _, key := range keys {
    if !forceAll && prior != nil && !dirty[key] {
      committed, exists := prior.shards[key]
      if !exists {
        return nil, nil, nil, nil, fmt.Errorf("ttscgraph: new graph shard %s was not marked dirty", key)
      }
      current[key] = committed
      manifest = append(manifest, serveGraphShardReference{Key: key, Digest: committed.digest})
      continue
    }
    shard := shards[key]
    normalizeServeGraphShard(&shard)
    digest, err := serveGraphShardDigest(shard)
    if err != nil {
      return nil, nil, nil, nil, err
    }
    current[key] = committedServeGraphShard{digest: digest, shard: shard}
    manifest = append(manifest, serveGraphShardReference{Key: key, Digest: digest})
  }
  var nodeOwners map[string]string
  var incomingEdges map[string]map[string]int
  var err error
  if forceAll || prior == nil {
    nodeOwners, incomingEdges, err = indexServeGraphShards(current, provenance.Universe)
  } else {
    nodeOwners, incomingEdges, err = updateServeGraphShardIndex(prior, current, dirty, provenance.Universe)
  }
  if err != nil {
    return nil, nil, nil, nil, err
  }
  generation, err := digestJSON(struct {
    Tsconfig     string                     `json:"tsconfig"`
    Producer     graph.Producer             `json:"producer"`
    Capabilities []string                   `json:"capabilities"`
    Universe     graph.Universe             `json:"universe"`
    Manifest     []serveGraphShardReference `json:"manifest"`
  }{
    Tsconfig:     identity.target,
    Producer:     provenance.Producer,
    Capabilities: provenance.Capabilities,
    Universe:     provenance.Universe,
    Manifest:     manifest,
  })
  if err != nil {
    return nil, nil, nil, nil, err
  }
  sequence := 1
  if prior != nil {
    sequence = prior.sequence + 1
  }
  snapshot := &serveGraphSnapshot{
    ProtocolVersion: graphSnapshotProtocolVersion,
    SchemaVersion:   graph.DumpSchemaVersion,
    Project:         identity.project,
    Tsconfig:        identity.target,
    Producer:        provenance.Producer,
    Capabilities:    append([]string{}, provenance.Capabilities...),
    Universe:        provenance.Universe,
    Sequence:        sequence,
    Generation:      generation,
    Upserts:         []serveGraphShardUpsert{},
    Deletes:         []string{},
    Manifest:        manifest,
  }
  if prior != nil {
    snapshot.BaseSequence = prior.sequence
    snapshot.BaseGeneration = prior.generation
    for key := range prior.shards {
      if _, exists := current[key]; !exists {
        snapshot.Deletes = append(snapshot.Deletes, key)
      }
    }
    sort.Strings(snapshot.Deletes)
  }
  for _, key := range keys {
    value := current[key]
    if forceAll || prior == nil || prior.shards[key].digest != value.digest {
      snapshot.Upserts = append(snapshot.Upserts, serveGraphShardUpsert{
        Digest: value.digest,
        Shard:  value.shard,
      })
    }
  }
  return snapshot, current, nodeOwners, incomingEdges, nil
}

func validateServeGraphShardHeaders(shards map[string]committedServeGraphShard, universe graph.Universe) error {
  sources := map[string]string{}
  configs := map[string]string{}
  for key, committed := range shards {
    if key == "" || strings.ContainsRune(key, '\x00') || committed.shard.Key != key {
      return fmt.Errorf("ttscgraph: invalid graph shard identity: %q", key)
    }
    if committed.shard.Source != nil && committed.shard.Config != nil {
      return fmt.Errorf("ttscgraph: shard %s claims both a source and a config input", key)
    }
    if committed.shard.Config != nil && (len(committed.shard.Nodes) != 0 || len(committed.shard.Edges) != 0) {
      return fmt.Errorf("ttscgraph: config shard %s unexpectedly owns graph facts", key)
    }
    if committed.shard.Config != nil {
      if _, exists := configs[committed.shard.Config.File]; exists {
        return fmt.Errorf("ttscgraph: config input %s has more than one shard", committed.shard.Config.File)
      }
      configs[committed.shard.Config.File] = committed.shard.Config.Digest
    }
    if committed.shard.Source != nil {
      if owner, exists := sources[committed.shard.Source.File]; exists {
        return fmt.Errorf("ttscgraph: source input %s is owned by both %s and %s", committed.shard.Source.File, owner, key)
      }
      sources[committed.shard.Source.File] = key
    }
  }
  if len(configs) != len(universe.Configs) {
    return fmt.Errorf("ttscgraph: config shards do not cover the build universe")
  }
  for _, config := range universe.Configs {
    if configs[config.File] != config.Digest {
      return fmt.Errorf("ttscgraph: config shard disagrees with universe input %s", config.File)
    }
  }
  return nil
}

func indexServeGraphShards(
  shards map[string]committedServeGraphShard,
  universe graph.Universe,
) (map[string]string, map[string]map[string]int, error) {
  if err := validateServeGraphShardHeaders(shards, universe); err != nil {
    return nil, nil, err
  }
  owners := map[string]string{}
  incoming := map[string]map[string]int{}
  for key, committed := range shards {
    if err := validateServeGraphShardContents(key, committed.shard); err != nil {
      return nil, nil, err
    }
    for _, node := range committed.shard.Nodes {
      if owner, exists := owners[node.ID]; exists {
        return nil, nil, fmt.Errorf("ttscgraph: node %s is owned by both %s and %s", node.ID, owner, key)
      }
      owners[node.ID] = key
    }
  }
  for key, committed := range shards {
    for _, edge := range committed.shard.Edges {
      if owners[edge.From] != key {
        return nil, nil, fmt.Errorf("ttscgraph: shard %s does not own edge source %s", key, edge.From)
      }
      if _, exists := owners[edge.To]; !exists {
        return nil, nil, fmt.Errorf("ttscgraph: edge target is absent from committed shards: %s", edge.To)
      }
      addServeGraphIncomingEdge(incoming, edge.To, key)
    }
  }
  return owners, incoming, nil
}

func updateServeGraphShardIndex(
  prior *serveGraphStore,
  current map[string]committedServeGraphShard,
  dirty map[string]bool,
  universe graph.Universe,
) (map[string]string, map[string]map[string]int, error) {
  if err := validateServeGraphShardHeaders(current, universe); err != nil {
    return nil, nil, err
  }
  owners := maps.Clone(prior.nodeOwners)
  incoming := cloneServeGraphIncomingEdges(prior.incomingEdges)
  touched := maps.Clone(dirty)
  for key := range prior.shards {
    if _, exists := current[key]; !exists {
      touched[key] = true
    }
  }
  removedNodes := map[string]bool{}
  for key := range touched {
    committed, exists := prior.shards[key]
    if !exists {
      continue
    }
    for _, edge := range committed.shard.Edges {
      removeServeGraphIncomingEdge(incoming, edge.To, key)
    }
    for _, node := range committed.shard.Nodes {
      if owners[node.ID] == key {
        delete(owners, node.ID)
        removedNodes[node.ID] = true
      }
    }
  }
  for key := range dirty {
    committed, exists := current[key]
    if !exists {
      return nil, nil, fmt.Errorf("ttscgraph: dirty graph shard %s is absent from the next generation", key)
    }
    if err := validateServeGraphShardContents(key, committed.shard); err != nil {
      return nil, nil, err
    }
    for _, node := range committed.shard.Nodes {
      if owner, exists := owners[node.ID]; exists {
        return nil, nil, fmt.Errorf("ttscgraph: node %s is owned by both %s and %s", node.ID, owner, key)
      }
      owners[node.ID] = key
    }
  }
  for key := range dirty {
    for _, edge := range current[key].shard.Edges {
      if owners[edge.From] != key {
        return nil, nil, fmt.Errorf("ttscgraph: shard %s does not own edge source %s", key, edge.From)
      }
      if _, exists := owners[edge.To]; !exists {
        return nil, nil, fmt.Errorf("ttscgraph: edge target is absent from committed shards: %s", edge.To)
      }
      addServeGraphIncomingEdge(incoming, edge.To, key)
    }
  }
  for id := range removedNodes {
    if _, exists := owners[id]; exists {
      continue
    }
    if len(incoming[id]) != 0 {
      return nil, nil, fmt.Errorf("ttscgraph: removed node %s is still referenced by an unchanged shard", id)
    }
    delete(incoming, id)
  }
  return owners, incoming, nil
}

func validateServeGraphShardContents(key string, shard serveGraphShard) error {
  if shard.Source != nil {
    for _, node := range shard.Nodes {
      if node.External || node.File != shard.Source.File {
        return fmt.Errorf("ttscgraph: source shard %s owns node %s from %s", key, node.ID, node.File)
      }
    }
    for _, diagnostic := range shard.Diagnostics {
      if diagnostic.File != shard.Source.File {
        return fmt.Errorf("ttscgraph: source shard %s owns diagnostic from %s", key, diagnostic.File)
      }
    }
    return nil
  }
  if len(shard.Edges) != 0 {
    return fmt.Errorf("ttscgraph: non-source shard %s unexpectedly owns edges", key)
  }
  if shard.Config != nil {
    for _, diagnostic := range shard.Diagnostics {
      if diagnostic.File != shard.Config.File {
        return fmt.Errorf("ttscgraph: config shard %s owns diagnostic from %s", key, diagnostic.File)
      }
    }
    return nil
  }
  for _, node := range shard.Nodes {
    if !node.External {
      return fmt.Errorf("ttscgraph: metadata shard %s owns authored node %s", key, node.ID)
    }
  }
  for _, diagnostic := range shard.Diagnostics {
    if diagnostic.File != "" {
      return fmt.Errorf("ttscgraph: metadata shard %s owns diagnostic from %s", key, diagnostic.File)
    }
  }
  return nil
}

func cloneServeGraphIncomingEdges(input map[string]map[string]int) map[string]map[string]int {
  cloned := make(map[string]map[string]int, len(input))
  for id, owners := range input {
    cloned[id] = maps.Clone(owners)
  }
  return cloned
}

func cloneServeGraphStringSets(input map[string]map[string]bool) map[string]map[string]bool {
  cloned := make(map[string]map[string]bool, len(input))
  for key, values := range input {
    cloned[key] = maps.Clone(values)
  }
  return cloned
}

func serveGraphExternalNodeWireIDs(project string, nodes map[string]*graph.Node) (map[string]string, error) {
  ids := []string{}
  for id, node := range nodes {
    if node.External {
      ids = append(ids, id)
    }
  }
  sort.Strings(ids)
  return graph.WireNodeIDs(project, ids)
}

func addServeGraphIncomingEdge(incoming map[string]map[string]int, target, owner string) {
  owners := incoming[target]
  if owners == nil {
    owners = map[string]int{}
    incoming[target] = owners
  }
  owners[owner]++
}

func removeServeGraphIncomingEdge(incoming map[string]map[string]int, target, owner string) {
  owners := incoming[target]
  if owners == nil {
    return
  }
  if owners[owner] <= 1 {
    delete(owners, owner)
  } else {
    owners[owner]--
  }
  if len(owners) == 0 {
    delete(incoming, target)
  }
}

func partitionServeGraphFacts(
  identity serveGraphIdentity,
  provenance graph.Provenance,
  facts graph.DumpFacts,
  diagnostics []graph.Diagnostic,
  selected map[string]bool,
  knownExternal map[string]graph.DumpNode,
  resolutionDigests map[string]string,
) (
  map[string]serveGraphShard,
  map[string]string,
  map[string]string,
  map[string]graph.DumpNode,
  map[string]map[string]bool,
  error,
) {
  shards := map[string]serveGraphShard{}
  sourceKeys := map[string]string{}
  relativeToPhysical := map[string]string{}
  for _, source := range provenance.Sources {
    if selected != nil && !selected[source.File] {
      continue
    }
    relative, err := serveGraphFile(identity.project, source.File)
    if err != nil {
      return nil, nil, nil, nil, nil, err
    }
    sourceCopy := source
    sourceCopy.File = relative
    key := sourceServeGraphShardKey(identity, relative, source, resolutionDigests[source.File])
    shards[key] = emptyServeGraphShard(key, &sourceCopy)
    sourceKeys[source.File] = key
    relativeToPhysical[relative] = source.File
  }
  if selected == nil {
    for _, config := range provenance.Universe.Configs {
      relative, err := serveGraphFile(identity.project, config.File)
      if err != nil {
        return nil, nil, nil, nil, nil, err
      }
      configCopy := config
      configCopy.File = relative
      key := configServeGraphShardKey(identity, relative, config.Digest)
      shard := emptyServeGraphShard(key, nil)
      shard.Config = &configCopy
      shards[key] = shard
      if _, exists := sourceKeys[config.File]; !exists {
        sourceKeys[config.File] = key
      }
      relativeToPhysical[relative] = config.File
    }
  }
  metadataKey := metadataServeGraphShardKey(identity)
  shards[metadataKey] = emptyServeGraphShard(metadataKey, nil)

  dumpNodeFiles := map[string]string{}
  externalNodes := map[string]graph.DumpNode{}
  for _, node := range facts.Nodes {
    if node.External {
      externalNodes[node.ID] = node
      continue
    }
    physical, ok := relativeToPhysical[node.File]
    if !ok {
      return nil, nil, nil, nil, nil, fmt.Errorf("ttscgraph: node source is absent from shard manifest: %s", node.File)
    }
    dumpNodeFiles[node.ID] = physical
    key := sourceKeys[physical]
    shard := shards[key]
    shard.Nodes = append(shard.Nodes, node)
    shards[key] = shard
  }
  sourceExternal := map[string]map[string]bool{}
  for _, edge := range facts.Edges {
    physical, ok := dumpNodeFiles[edge.From]
    if !ok {
      return nil, nil, nil, nil, nil, fmt.Errorf("ttscgraph: edge source node is absent from shard facts: %s", edge.From)
    }
    key := sourceKeys[physical]
    shard := shards[key]
    shard.Edges = append(shard.Edges, edge)
    shards[key] = shard
    _, discovered := externalNodes[edge.To]
    _, committed := knownExternal[edge.To]
    if discovered || committed {
      targets := sourceExternal[key]
      if targets == nil {
        targets = map[string]bool{}
        sourceExternal[key] = targets
      }
      targets[edge.To] = true
    }
  }
  for _, diagnostic := range diagnostics {
    if diagnostic.File == "" {
      shard := shards[metadataKey]
      shard.Diagnostics = append(shard.Diagnostics, diagnostic)
      shards[metadataKey] = shard
      continue
    }
    key := sourceKeys[diagnostic.File]
    shard, ok := shards[key]
    if !ok {
      if selected != nil {
        // Config and stable program diagnostics are repeated by tsgo's
        // per-file diagnostic API. Their owning shards are outside this
        // replacement set and remain committed unchanged.
        continue
      }
      return nil, nil, nil, nil, nil, fmt.Errorf("ttscgraph: diagnostic source is absent from shard manifest: %s", diagnostic.File)
    }
    normalized := diagnostic
    relative, err := serveGraphFile(identity.project, diagnostic.File)
    if err != nil {
      return nil, nil, nil, nil, nil, err
    }
    normalized.File = relative
    shard.Diagnostics = append(shard.Diagnostics, normalized)
    shards[key] = shard
  }
  return shards, sourceKeys, dumpNodeFiles, externalNodes, sourceExternal, nil
}

func installExternalShard(
  shards map[string]serveGraphShard,
  identity serveGraphIdentity,
  externalNodes map[string]graph.DumpNode,
  references map[string]int,
) error {
  key := externalServeGraphShardKey(identity)
  shard := emptyServeGraphShard(key, nil)
  for id, count := range references {
    if count > 0 {
      node, ok := externalNodes[id]
      if !ok {
        return fmt.Errorf("ttscgraph: external edge target is absent from committed endpoints: %s", id)
      }
      shard.Nodes = append(shard.Nodes, node)
    }
  }
  shards[key] = shard
  return nil
}

func normalizeServeGraphShard(shard *serveGraphShard) {
  if shard.Nodes == nil {
    shard.Nodes = []graph.DumpNode{}
  }
  if shard.Edges == nil {
    shard.Edges = []graph.DumpEdge{}
  }
  if shard.Diagnostics == nil {
    shard.Diagnostics = []graph.Diagnostic{}
  }
  sort.Slice(shard.Nodes, func(i, j int) bool { return shard.Nodes[i].ID < shard.Nodes[j].ID })
  sort.Slice(shard.Edges, func(i, j int) bool {
    if shard.Edges[i].From != shard.Edges[j].From {
      return shard.Edges[i].From < shard.Edges[j].From
    }
    if shard.Edges[i].To != shard.Edges[j].To {
      return shard.Edges[i].To < shard.Edges[j].To
    }
    return shard.Edges[i].Kind < shard.Edges[j].Kind
  })
  sort.Slice(shard.Diagnostics, func(i, j int) bool {
    if shard.Diagnostics[i].File != shard.Diagnostics[j].File {
      return shard.Diagnostics[i].File < shard.Diagnostics[j].File
    }
    if shard.Diagnostics[i].Line != shard.Diagnostics[j].Line {
      return shard.Diagnostics[i].Line < shard.Diagnostics[j].Line
    }
    if shard.Diagnostics[i].Column != shard.Diagnostics[j].Column {
      return shard.Diagnostics[i].Column < shard.Diagnostics[j].Column
    }
    return shard.Diagnostics[i].Code < shard.Diagnostics[j].Code
  })
}

func emptyServeGraphShard(key string, source *graph.SourceDigest) serveGraphShard {
  return serveGraphShard{
    Key:         key,
    Source:      source,
    Nodes:       []graph.DumpNode{},
    Edges:       []graph.DumpEdge{},
    Diagnostics: []graph.Diagnostic{},
  }
}

func serveGraphShardDigest(shard serveGraphShard) (string, error) {
  return digestJSON(shard)
}

func digestJSON(value any) (string, error) {
  encoded, err := json.Marshal(value)
  if err != nil {
    return "", fmt.Errorf("ttscgraph: encode shard digest: %w", err)
  }
  sum := sha256.Sum256(encoded)
  return hex.EncodeToString(sum[:]), nil
}

func newServeGraphIdentity(project, tsconfig string, provenance graph.Provenance) (serveGraphIdentity, graph.Provenance, map[string]string, error) {
  if !filepath.IsAbs(project) {
    return serveGraphIdentity{}, graph.Provenance{}, nil, fmt.Errorf("ttscgraph: project root must be absolute: %s", project)
  }
  wireProject, err := graph.WireProject(project)
  if err != nil {
    return serveGraphIdentity{}, graph.Provenance{}, nil, err
  }
  target := tsconfig
  if !filepath.IsAbs(target) {
    target = filepath.Join(project, target)
  }
  target, err = serveGraphFile(project, filepath.Clean(target))
  if err != nil {
    return serveGraphIdentity{}, graph.Provenance{}, nil, err
  }
  normalized, wireSources, err := normalizeServeGraphProvenance(project, provenance)
  if err != nil {
    return serveGraphIdentity{}, graph.Provenance{}, nil, err
  }
  universe, err := digestJSON(normalized.Universe)
  if err != nil {
    return serveGraphIdentity{}, graph.Provenance{}, nil, err
  }
  return serveGraphIdentity{
    project:  wireProject,
    target:   target,
    universe: universe,
    producer: provenance.Producer,
  }, normalized, wireSources, nil
}

func normalizeServeGraphProvenance(project string, provenance graph.Provenance) (graph.Provenance, map[string]string, error) {
  normalized := provenance
  normalized.Capabilities = append([]string{}, provenance.Capabilities...)
  normalized.Sources = make([]graph.SourceDigest, 0, len(provenance.Sources))
  wireSources := make(map[string]string, len(provenance.Sources))
  sourceOwners := map[string]string{}
  for _, source := range provenance.Sources {
    file, err := serveGraphFile(project, source.File)
    if err != nil {
      return graph.Provenance{}, nil, err
    }
    if previous, exists := sourceOwners[file]; exists {
      return graph.Provenance{}, nil, fmt.Errorf("ttscgraph: source paths %q and %q collide at wire identity %q", previous, source.File, file)
    }
    sourceOwners[file] = source.File
    wireSources[source.File] = file
    normalized.Sources = append(normalized.Sources, graph.SourceDigest{
      File:    file,
      Checker: source.Checker,
      Disk:    source.Disk,
    })
  }
  normalized.Universe.Configs = make([]graph.FileDigest, 0, len(provenance.Universe.Configs))
  configOwners := map[string]string{}
  for _, config := range provenance.Universe.Configs {
    file, err := serveGraphFile(project, config.File)
    if err != nil {
      return graph.Provenance{}, nil, err
    }
    if previous, exists := configOwners[file]; exists {
      return graph.Provenance{}, nil, fmt.Errorf("ttscgraph: config paths %q and %q collide at wire identity %q", previous, config.File, file)
    }
    configOwners[file] = config.File
    normalized.Universe.Configs = append(normalized.Universe.Configs, graph.FileDigest{File: file, Digest: config.Digest})
  }
  normalized.Universe.Roots = make([]graph.RootFile, 0, len(provenance.Universe.Roots))
  for _, root := range provenance.Universe.Roots {
    config, err := serveGraphFile(project, root.Config)
    if err != nil {
      return graph.Provenance{}, nil, err
    }
    file, err := serveGraphFile(project, root.File)
    if err != nil {
      return graph.Provenance{}, nil, err
    }
    normalized.Universe.Roots = append(normalized.Universe.Roots, graph.RootFile{Config: config, File: file})
  }
  sort.Slice(normalized.Sources, func(i, j int) bool { return normalized.Sources[i].File < normalized.Sources[j].File })
  sort.Slice(normalized.Universe.Configs, func(i, j int) bool {
    return normalized.Universe.Configs[i].File < normalized.Universe.Configs[j].File
  })
  sort.Slice(normalized.Universe.Roots, func(i, j int) bool {
    if normalized.Universe.Roots[i].Config != normalized.Universe.Roots[j].Config {
      return normalized.Universe.Roots[i].Config < normalized.Universe.Roots[j].Config
    }
    return normalized.Universe.Roots[i].File < normalized.Universe.Roots[j].File
  })
  return normalized, wireSources, nil
}

func advanceServeGraphProvenance(
  previous graph.Provenance,
  previousWire graph.Provenance,
  wireSources map[string]string,
  program *driver.Program,
  changed []string,
  diskDigests map[string]string,
) (graph.Provenance, graph.Provenance, bool) {
  next := previous
  next.Capabilities = append([]string{}, previous.Capabilities...)
  next.Sources = append([]graph.SourceDigest{}, previous.Sources...)
  next.Universe.Configs = append([]graph.FileDigest{}, previous.Universe.Configs...)
  next.Universe.Roots = append([]graph.RootFile{}, previous.Universe.Roots...)
  nextWire := previousWire
  nextWire.Capabilities = append([]string{}, previousWire.Capabilities...)
  nextWire.Sources = append([]graph.SourceDigest{}, previousWire.Sources...)
  nextWire.Universe.Configs = append([]graph.FileDigest{}, previousWire.Universe.Configs...)
  nextWire.Universe.Roots = append([]graph.RootFile{}, previousWire.Universe.Roots...)
  if len(nextWire.Sources) != len(next.Sources) {
    return graph.Provenance{}, graph.Provenance{}, false
  }
  positions := make(map[string]int, len(next.Sources))
  for index, source := range next.Sources {
    positions[source.File] = index
  }
  wirePositions := make(map[string]int, len(nextWire.Sources))
  for index, source := range nextWire.Sources {
    wirePositions[source.File] = index
  }
  for _, file := range changed {
    source := program.SourceFile(file)
    if source == nil {
      return graph.Provenance{}, graph.Provenance{}, false
    }
    physical := source.FileName()
    index, ok := positions[physical]
    if !ok {
      return graph.Provenance{}, graph.Provenance{}, false
    }
    updated := graph.SourceDigest{
      File:    physical,
      Checker: graph.Digest(sha256.Sum256([]byte(source.Text()))),
      Disk:    diskDigests[physical],
    }
    wireFile, ok := wireSources[physical]
    if !ok {
      return graph.Provenance{}, graph.Provenance{}, false
    }
    wireIndex, ok := wirePositions[wireFile]
    if !ok {
      return graph.Provenance{}, graph.Provenance{}, false
    }
    next.Sources[index] = updated
    nextWire.Sources[wireIndex].Checker = updated.Checker
    nextWire.Sources[wireIndex].Disk = updated.Disk
  }
  return next, nextWire, true
}

func sourceServeGraphShardKey(identity serveGraphIdentity, file string, source graph.SourceDigest, resolutionDigest string) string {
  prefix := "1"
  if strings.HasPrefix(file, "bundled:///") {
    prefix = "2"
  }
  return prefix + ":source:" + serveGraphShardKey(identity, file, source.Checker, source.Disk, resolutionDigest)
}

func configServeGraphShardKey(identity serveGraphIdentity, file, digest string) string {
  return "3:config:" + serveGraphShardKey(identity, file, digest)
}

func externalServeGraphShardKey(identity serveGraphIdentity) string {
  return "0:external:" + serveGraphShardKey(identity, "external")
}

func metadataServeGraphShardKey(identity serveGraphIdentity) string {
  return "0:metadata:" + serveGraphShardKey(identity, "metadata")
}

func serveGraphShardKey(identity serveGraphIdentity, values ...string) string {
  coordinates := []any{
    graphSnapshotProtocolVersion,
    identity.producer.Tool,
    identity.producer.Version,
    identity.producer.Typescript,
    identity.target,
    identity.universe,
  }
  for _, value := range values {
    coordinates = append(coordinates, value)
  }
  encoded, _ := json.Marshal(coordinates)
  return string(encoded)
}

func serveGraphFile(project, file string) (string, error) {
  relative, err := graph.WirePath(project, file)
  if err != nil {
    return "", fmt.Errorf("ttscgraph: relativize shard source %s: %w", file, err)
  }
  return relative, nil
}

func rawServeShards(shards map[string]committedServeGraphShard) map[string]serveGraphShard {
  out := make(map[string]serveGraphShard, len(shards))
  for key, shard := range shards {
    out[key] = shard.shard
  }
  return out
}

func invalidatedGraphFiles(
  program *driver.Program,
  reverse map[string][]string,
  changed []string,
  publicChanged []string,
) map[string]bool {
  authored := authoredGraphFiles(program)
  selected := map[string]bool{}
  for _, file := range changed {
    source := graphSourceFile(program, file)
    if source == nil {
      return nil
    }
    if shimcompiler.FileAffectsGlobalScope(source) {
      return authored
    }
    selected[file] = true
  }
  pending := append([]string{}, publicChanged...)
  for len(pending) > 0 {
    file := pending[0]
    pending = pending[1:]
    source := graphSourceFile(program, file)
    if source == nil {
      return nil
    }
    if shimcompiler.FileAffectsGlobalScope(source) {
      return authored
    }
    selected[file] = true
    for _, dependent := range reverse[file] {
      if !selected[dependent] {
        selected[dependent] = true
        pending = append(pending, dependent)
      }
    }
  }
  return selected
}

func authoredGraphFiles(program *driver.Program) map[string]bool {
  authored := map[string]bool{}
  for _, file := range program.SourceFiles() {
    authored[file.FileName()] = true
  }
  return authored
}

func reverseGraphDependencies(program *driver.Program) map[string][]string {
  reverseSets := map[string]map[string]bool{}
  authored := map[string]bool{}
  authoredByPath := map[string]string{}
  for _, file := range program.SourceFiles() {
    authored[file.FileName()] = true
    authoredByPath[string(file.Path())] = file.FileName()
  }
  add := func(target, dependent string) {
    if !authored[target] || target == dependent {
      return
    }
    values := reverseSets[target]
    if values == nil {
      values = map[string]bool{}
      reverseSets[target] = values
    }
    values[dependent] = true
  }
  for _, source := range program.SourceFiles() {
    for _, referencedPath := range shimcompiler.GetReferencedFilePaths(program.TSProgram, source) {
      if target, ok := authoredByPath[referencedPath]; ok {
        add(target, source.FileName())
      }
    }
  }
  reverse := map[string][]string{}
  for target, dependents := range reverseSets {
    values := make([]string, 0, len(dependents))
    for dependent := range dependents {
      values = append(values, dependent)
    }
    sort.Strings(values)
    reverse[target] = values
  }
  return reverse
}

func serveGraphResolutionDigests(program *driver.Program, project string) (map[string]string, error) {
  digests := map[string]string{}
  for _, source := range program.TSProgram.SourceFiles() {
    raw := shimcompiler.GetReferencedFilePaths(program.TSProgram, source)
    references := make([]string, 0, len(raw))
    for _, reference := range raw {
      target := program.TSProgram.GetSourceFileByPath(shimtspath.Path(reference))
      if target == nil {
        continue
      }
      file, err := serveGraphFile(project, target.FileName())
      if err != nil {
        return nil, err
      }
      references = append(references, file)
    }
    sort.Strings(references)
    digest, _ := digestJSON(references)
    digests[source.FileName()] = digest
  }
  return digests, nil
}

func graphSourceFile(program *driver.Program, file string) *shimast.SourceFile {
  for _, source := range program.SourceFiles() {
    if source.FileName() == file {
      return source
    }
  }
  return nil
}

func sortedSelectedFiles(selected map[string]bool) []string {
  files := make([]string, 0, len(selected))
  for file := range selected {
    files = append(files, file)
  }
  sort.Strings(files)
  return files
}

func addPriorExportTargets(selected map[string]bool, prior *serveGraphStore) {
  for file := range maps.Clone(selected) {
    shard, ok := prior.shards[prior.sourceKeys[file]]
    if !ok {
      continue
    }
    for _, edge := range shard.shard.Edges {
      if edge.Kind != "exports" {
        continue
      }
      target, ok := prior.dumpNodeFiles[edge.To]
      if ok {
        selected[target] = true
      }
    }
  }
}

func expandPriorImplementationSources(selected map[string]bool, prior *serveGraphStore) {
  for {
    expanded := false
    for id, sources := range prior.implementationSources {
      owner := graph.NodeFile(id)
      affected := selected[owner]
      if !affected {
        for source := range sources {
          if selected[source] {
            affected = true
            break
          }
        }
      }
      if !affected {
        continue
      }
      if owner != "" && !selected[owner] {
        selected[owner] = true
        expanded = true
      }
      for source := range sources {
        if !selected[source] {
          selected[source] = true
          expanded = true
        }
      }
    }
    if !expanded {
      return
    }
  }
}
