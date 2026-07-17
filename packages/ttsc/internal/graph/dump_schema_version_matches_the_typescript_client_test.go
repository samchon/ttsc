package graph

import (
  "bytes"
  "os"
  "path/filepath"
  "regexp"
  "strconv"
  "testing"
)

// TestDumpSchemaVersionMatchesTheTypescriptClient verifies the Go producer and
// the TypeScript reader agree on the dump schema version.
//
// The dump body is mirrored by hand: Dump here, ITtscGraphDump in @ttsc/graph.
// A dump also outlives the process that wrote it — the one-shot command writes
// JSON to a file that any later build may read — so the version is what tells a
// reader whether the document in front of it is the document it understands. It
// can only do that while both sides mean the same number by it.
//
//  1. Read DUMP_SCHEMA_VERSION out of the TypeScript reader's source.
//  2. Compare it to DumpSchemaVersion.
func TestDumpSchemaVersionMatchesTheTypescriptClient(t *testing.T) {
  reader := filepath.Join("..", "..", "..", "graph", "src", "model", "loadGraph.ts")
  source, err := os.ReadFile(reader)
  if err != nil {
    t.Fatalf("read the TypeScript reader: %v", err)
  }
  // The checkout is CRLF on Windows, and a line-anchored match would never
  // see the end of a line that ends in a carriage return.
  source = bytes.ReplaceAll(source, []byte("\r\n"), []byte("\n"))
  match := regexp.MustCompile(`(?m)^(?:export )?const DUMP_SCHEMA_VERSION = (\d+);$`).FindSubmatch(source)
  if match == nil {
    t.Fatalf("no `const DUMP_SCHEMA_VERSION = <n>;` in %s; if it moved, this gate must follow it", reader)
  }
  declared, err := strconv.Atoi(string(match[1]))
  if err != nil {
    t.Fatalf("DUMP_SCHEMA_VERSION is not a number: %v", err)
  }
  if declared != DumpSchemaVersion {
    t.Fatalf(
      "dump schema drifted: Go produces v%d, %s reads v%d",
      DumpSchemaVersion,
      reader,
      declared,
    )
  }
}
