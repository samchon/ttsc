package graph

import (
  "strings"
  "testing"
)

// TestDumpPathMapperUsesPortableCoordinates verifies the schema-v6 vocabulary
// directly, independent of the host OS running the test.
//
//  1. Map in-project and sibling paths for POSIX, drive, and UNC layouts.
//  2. Keep two pnpm version/peer contexts with the same package subpath apart.
//  3. Preserve compiler virtual identities exactly.
func TestDumpPathMapperUsesPortableCoordinates(t *testing.T) {
  tests := []struct {
    name    string
    project string
    file    string
    want    string
  }{
    {"posix-project", "/checkout/app", "/checkout/app/src/main.ts", "src/main.ts"},
    {"posix-sibling", "/checkout/app", "/checkout/shared/src/value.ts", "../shared/src/value.ts"},
    {"windows-project", `C:\checkout\app`, `C:\checkout\app\src\main.ts`, "src/main.ts"},
    {"windows-sibling", `C:\checkout\app`, `C:\checkout\shared\src\value.ts`, "../shared/src/value.ts"},
    {"unc-project", `\\server\share\checkout\app`, `\\server\share\checkout\app\src\main.ts`, "src/main.ts"},
    {"unc-sibling", `\\server\share\checkout\app`, `\\server\share\checkout\shared\src\value.ts`, "../shared/src/value.ts"},
    {
      "pnpm-peer-a",
      "/checkout/app",
      "/checkout/app/node_modules/.pnpm/pkg@1.0.0_peer-a/node_modules/pkg/index.d.ts",
      "node_modules/.pnpm/pkg@1.0.0_peer-a/node_modules/pkg/index.d.ts",
    },
    {
      "pnpm-peer-b",
      "/checkout/app",
      "/checkout/app/node_modules/.pnpm/pkg@2.0.0_peer-b/node_modules/pkg/index.d.ts",
      "node_modules/.pnpm/pkg@2.0.0_peer-b/node_modules/pkg/index.d.ts",
    },
    {"bundled", "/checkout/app", "bundled:///lib.es2024.d.ts", "bundled:///lib.es2024.d.ts"},
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      mapper := newDumpPathMapper(test.project)
      if got := mapper.mapPath(test.file); got != test.want {
        t.Fatalf("mapPath(%q) = %q, want %q", test.file, got, test.want)
      }
      if err := mapper.err(); err != nil {
        t.Fatalf("mapPath(%q): %v", test.file, err)
      }
    })
  }
}

// TestDumpPathMapperRejectsUnportableRootsAndCollisions pins both fail-closed
// boundaries of the mapping contract.
//
//  1. Reject a different Windows drive and a different UNC share precisely.
//  2. Force two physical sources through one coordinate and require a collision.
//  3. Require NewDump to surface the root error before JSON serialization.
func TestDumpPathMapperRejectsUnportableRootsAndCollisions(t *testing.T) {
  for _, test := range []struct {
    name    string
    project string
    file    string
  }{
    {"windows-drive", "C:/checkout/app", "D:/shared/value.ts"},
    {"unc-share", "//server/share-a/app", "//server/share-b/value.ts"},
  } {
    t.Run(test.name, func(t *testing.T) {
      mapper := newDumpPathMapper(test.project)
      mapper.mapPath(test.file)
      if err := mapper.err(); err == nil || !strings.Contains(err.Error(), "different filesystem roots") {
        t.Fatalf("cross-root error = %v, want a precise filesystem-root rejection", err)
      }
    })
  }

  collision := newDumpPathMapper("/checkout/app")
  collision.claim("/physical/one.ts", "shared.ts")
  collision.claim("/physical/two.ts", "shared.ts")
  if err := collision.err(); err == nil || !strings.Contains(err.Error(), "collide at wire identity") {
    t.Fatalf("collision error = %v, want an injectivity rejection", err)
  }

  file := "D:/shared/value.ts"
  id := nodeID(file, "value", NodeVariable)
  _, err := NewDump(&Graph{Nodes: map[string]*Node{
    id: &Node{ID: id, Name: "value", Simple: "value", Kind: NodeVariable, File: file},
  }}, "C:/checkout/app", "tsconfig.json", nil, nil, DumpOrigin{})
  if err == nil || !strings.Contains(err.Error(), "different filesystem roots") {
    t.Fatalf("NewDump cross-root error = %v, want rejection before serialization", err)
  }
}
