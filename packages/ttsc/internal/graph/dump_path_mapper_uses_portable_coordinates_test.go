package graph

import (
  "testing"
)

// TestDumpPathMapperUsesPortableCoordinates verifies the dump path vocabulary
// for nine authored POSIX, drive, UNC, pnpm-context and bundled path cases.
// Host-compatible absolute spellings can still undergo native canonicalization;
// these literals do not authenticate filesystem identities on every OS.
//
//  1. Map in-project and sibling paths for POSIX, drive, and UNC layouts.
//  2. Keep two pnpm version/peer contexts with the same package subpath apart.
//  3. Preserve compiler virtual identities exactly.
//
// @evidence contracts/testing.md#behavioral-verification The actual mapper must return each of nine literal coordinates without a latched error: project and sibling coordinates for three root grammars, two full pnpm context paths, and one unchanged bundled path. This is not cross-platform native identity authentication.
// @evidence contracts/testing.md#independent-expectations The expectations are the literal coordinates in the table: in-project paths map to src/main.ts, same-root siblings to ../shared/src/value.ts for POSIX, drive and UNC layouts, two pnpm version/peer package paths keep their full distinct node_modules/.pnpm/... paths, and a bundled:/// path is preserved exactly, with no mapping error in any case.
// @evidence contracts/testing.md#distinguishing-cases Map in-project and sibling paths for POSIX, drive, and UNC layouts; Keep two pnpm version/peer contexts with the same package subpath apart; Preserve compiler virtual identities exactly.
// @evidence contracts/testing.md#execution-ownership This same-package Go unit directly constructs one mapper per authored path row and calls mapPath. Host-compatible paths can trigger best-effort native canonicalization and ancestor reads; no fixture filesystem objects, compiler Program, installed consumer or product process are created.
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
