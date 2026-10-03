package main

import (
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// preparedDumpProjection carries the actual graph and its owning completion.
// Ignore membership is evaluated outside the compiler/state owner, then applied
// to this exact graph. A failed publication leaves its change pending.
type preparedDumpProjection struct {
  built *graph.Graph
  publish func(map[string]bool) (*graph.Dump, error)
}

// preparedShardProjection separates graph preparation from Git acquisition.
// A fallback is another prepared graph, not a canned transaction: callers must
// evaluate membership for that graph before completing it too.
type preparedShardProjection struct {
  built *graph.Graph
  change *graphChange
  publish func(map[string]bool) (*serveGraphSnapshot, *serveGraphStore, *preparedShardProjection, error)
}

// completeShardProjection applies already evaluated membership to an actual
// prepared graph. Its returned continuation preserves partial/full fallback.
func completeShardProjection(prepared *preparedShardProjection, ignored map[string]bool) (*serveGraphSnapshot, *serveGraphStore, *preparedShardProjection, error) {
  return prepared.publish(ignored)
}

// publishNativeShardProjection evaluates real Git membership for each exact
// prepared graph, including a complete fallback that replaces a partial graph.
// Synchronous Git acquisition joins its child before completing publication.
func publishNativeShardProjection(prepared *preparedShardProjection, cwd string) (*serveGraphSnapshot, *serveGraphStore, error) {
  for {
    snapshot, store, fallback, err := completeShardProjection(prepared, graph.GitIgnoredFiles(cwd, prepared.built))
    if err != nil || fallback == nil { return snapshot, store, err }
    prepared = fallback
  }
}

// serveSnapshotPublisher is the transport's declared publication port. The
// resident compiler and request state remain real; only acquisition belongs to
// the native adapter rather than the protocol/state operation.
type serveSnapshotPublisher interface {
  dump(*graphSession) (*graph.Dump, string, bool, error)
  shards(*graphSession) (*serveGraphSnapshot, string, bool, time.Duration, time.Duration, error)
}

type nativeSnapshotPublisher struct{}

func (nativeSnapshotPublisher) dump(session *graphSession) (*graph.Dump, string, bool, error) {
  return session.Snapshot()
}

func (nativeSnapshotPublisher) shards(session *graphSession) (*serveGraphSnapshot, string, bool, time.Duration, time.Duration, error) {
  return session.snapshotShardsWithTiming()
}
