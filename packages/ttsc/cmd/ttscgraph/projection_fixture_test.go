package main

import (
  "io"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// The dump command's actual preparation owns grammar and capability claims.
// The leading dispatch word is supplied by these source command fixtures.
func runSourceDumpCommand(args []string) int {
  if len(args) == 0 || strings.TrimSpace(args[0]) != "dump" { return 2 }
  prepared, code := prepareDumpCommand(args[1:])
  if prepared == nil { return code }
  defer func() { _ = prepared.program.Close() }()
  return prepared.encode(nil)
}

// Source fixtures contain no ignore-rule input. Their explicit empty membership
// is domain data for the real prepared projection, not a simulated Git result.
// Native Git acquisition is exercised separately through the default adapters.
func snapshotGraphState(session *graphSession) (*graph.Dump, string, bool, error) {
  prepared, mode, changed, err := session.prepareDumpSnapshot()
  if err != nil || prepared == nil { return nil, mode, changed, err }
  dump, err := prepared.publish(nil)
  if err != nil { return nil, "", false, err }
  return dump, mode, true, nil
}

func projectGraphDump(session *graphSession) (graph.Dump, error) {
  dump, err := session.prepareDumpProjection().publish(nil)
  if err != nil { return graph.Dump{}, err }
  return *dump, nil
}

func projectGraphShards(prepared *preparedShardProjection) (*serveGraphSnapshot, *serveGraphStore, error) {
  for {
    snapshot, store, fallback, err := completeShardProjection(prepared, nil)
    if err != nil || fallback == nil { return snapshot, store, err }
    prepared = fallback
  }
}

func projectFullGraphShards(session *graphSession) (*serveGraphSnapshot, *serveGraphStore, error) {
  prepared, err := session.prepareFullShardProjection()
  if err != nil { return nil, nil, err }
  return projectGraphShards(prepared)
}

func snapshotGraphShardState(session *graphSession) (*serveGraphSnapshot, string, bool, error) {
  snapshot, mode, changed, _, _, err := (sourceSnapshotPublisher{}).shards(session)
  return snapshot, mode, changed, err
}

type sourceSnapshotPublisher struct{}

func (sourceSnapshotPublisher) dump(session *graphSession) (*graph.Dump, string, bool, error) {
  return snapshotGraphState(session)
}

func (sourceSnapshotPublisher) shards(session *graphSession) (*serveGraphSnapshot, string, bool, time.Duration, time.Duration, error) {
  prepared, mode, changed, semanticDuration, preparationDuration, err := session.prepareShardSnapshot()
  if err != nil || prepared == nil { return nil, mode, changed, semanticDuration, preparationDuration, err }
  started := time.Now()
  snapshot, _, err := projectGraphShards(prepared)
  if err != nil { return nil, "", false, semanticDuration, preparationDuration + time.Since(started), err }
  return snapshot, prepared.change.mode, true, semanticDuration, preparationDuration + time.Since(started), nil
}

func serveSourceSnapshots(input io.Reader, output io.Writer, cwd, tsconfig string) int {
  return serveSnapshotRequests(input, output, cwd, tsconfig, nil, sourceSnapshotPublisher{})
}

func serveSourceSnapshotsWithArtifacts(input io.Reader, output io.Writer, cwd, tsconfig string, artifacts []graph.Artifact) int {
  return serveSnapshotRequests(input, output, cwd, tsconfig, artifacts, sourceSnapshotPublisher{})
}
