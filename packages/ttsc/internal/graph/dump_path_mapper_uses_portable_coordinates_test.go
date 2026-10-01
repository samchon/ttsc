package graph

import (
  "testing"
)

// TestDumpPathMapperUsesPortableCoordinates verifies the dump path vocabulary
// directly, independent of the host OS running the test.
//
//  1. Map in-project and sibling paths for POSIX, drive, and UNC layouts.
//  2. Keep two pnpm version/peer contexts with the same package subpath apart.
//  3. Preserve compiler virtual identities exactly.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the dump path vocabulary directly, independent of the host OS running the test.
// @evidence contracts/testing.md#independent-expectations The expectations are the literal coordinates in the table: in-project paths map to src/main.ts, same-root siblings to ../shared/src/value.ts for POSIX, drive and UNC layouts, two pnpm version/peer package paths keep their full distinct node_modules/.pnpm/... paths, and a bundled:/// path is preserved exactly, with no mapping error in any case.
// @evidence contracts/testing.md#distinguishing-cases Map in-project and sibling paths for POSIX, drive, and UNC layouts; Keep two pnpm version/peer contexts with the same package subpath apart; Preserve compiler virtual identities exactly.
// @evidence contracts/testing.md#execution-ownership TestDumpPathMapperUsesPortableCoordinates is a Go source-unit entry. newDumpPathMapper execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
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
