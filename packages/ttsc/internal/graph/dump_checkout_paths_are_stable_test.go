package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

const portableDumpTSConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true
  },
  "files": ["src/main.ts", "../shared/value.ts", "../shared/types.d.ts"]
}
`

// TestDumpCheckoutPathsAreStable verifies the whole schema-v6 consequence
// surface, not only the path helper.
//
//   1. Build the same project plus sibling .ts/.d.ts under two checkout roots.
//   2. Remove only the producer-local Project locator and require byte identity.
//   3. Assert nodes, module names, endpoints, implementation evidence,
//      diagnostics, manifests, and universe inputs all use one `../shared`
//      coordinate, with the .ts internal and the .d.ts an external leaf.
func TestDumpCheckoutPathsAreStable(t *testing.T) {
  firstCheckout := filepath.Join(t.TempDir(), "checkout-one")
  secondCheckout := filepath.Join(t.TempDir(), "checkout-two")
  first := portableFixtureDump(t, firstCheckout)
  second := portableFixtureDump(t, secondCheckout)

  first.Project = ""
  second.Project = ""
  firstJSON, err := json.Marshal(first)
  if err != nil {
    t.Fatal(err)
  }
  secondJSON, err := json.Marshal(second)
  if err != nil {
    t.Fatal(err)
  }
  if string(firstJSON) != string(secondJSON) {
    t.Fatalf("checkout relocation changed the dump:\nfirst  %s\nsecond %s", firstJSON, secondJSON)
  }

  assertPortableFixturePaths(t, first)
  if strings.Contains(string(firstJSON), filepath.ToSlash(firstCheckout)) ||
    strings.Contains(string(secondJSON), filepath.ToSlash(secondCheckout)) {
    t.Fatal("a producer-local checkout path escaped into schema-v6 identity")
  }
}

func portableFixtureDump(t *testing.T, checkout string) Dump {
  t.Helper()
  project := filepath.Join(checkout, "app")
  config := filepath.Join(project, "tsconfig.json")
  mainFile := filepath.Join(project, "src", "main.ts")
  siblingFile := filepath.Join(checkout, "shared", "value.ts")
  declarationFile := filepath.Join(checkout, "shared", "types.d.ts")

  writeFile(t, config, portableDumpTSConfig)
  writeFile(t, mainFile, `import { sibling } from "../../shared/value";
import type { ExternalShape } from "../../shared/types";
export function main(input: ExternalShape): number {
  return sibling(input.value);
}
`)
  writeFile(t, siblingFile, `export function sibling(value: number): number {
  return value;
}
export const broken: number = "nope";
`)
  writeFile(t, declarationFile, `export interface ExternalShape {
  value: number;
}
`)

  prog, _, err := driver.LoadProgram(project, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  built := Build(prog)
  // An implementation span is the one evidence path that cannot be recovered
  // from its owner node. Point one real node at the sibling source so this
  // end-to-end projection proves that optional path uses the same mapper too.
  for _, node := range built.Nodes {
    if node.Kind == NodeFunction && node.Name == "main" {
      node.ImplementationFile = siblingFile
      node.ImplementationPos = 0
      node.ImplementationEnd = len("export function sibling")
      break
    }
  }

  texts := SourceTexts(prog)
  dump, err := NewDump(
    built,
    project,
    "tsconfig.json",
    nil,
    texts,
    DumpOrigin{
      Provenance: NewProvenance(
        Producer{Tool: "portable-fixture", Version: "test", Typescript: TypescriptVersion()},
        []string{CapabilityUniverse, CapabilitySourceDigests, CapabilityDiagnostics},
        []FileDigest{{File: config, Digest: "config-digest"}},
        []RootFile{
          {Config: config, File: mainFile},
          {Config: config, File: siblingFile},
          {Config: config, File: declarationFile},
        },
        texts,
        nil,
      ),
      Diagnostics: NewDiagnostics(prog),
    },
  )
  if err != nil {
    t.Fatal(err)
  }
  return dump
}

func assertPortableFixturePaths(t *testing.T, dump Dump) {
  t.Helper()
  if dump.Tsconfig != "tsconfig.json" {
    t.Fatalf("tsconfig coordinate = %q", dump.Tsconfig)
  }

  var internal, external, module, implemented bool
  ids := map[string]bool{}
  for _, node := range dump.Nodes {
    ids[node.ID] = true
    switch {
    case node.Kind == string(NodeFunction) && node.Name == "sibling":
      internal = node.File == "../shared/value.ts" && !node.External &&
        strings.HasPrefix(node.ID, "../shared/value.ts#")
    case node.Name == "ExternalShape":
      external = node.File == "../shared/types.d.ts" && node.External &&
        strings.HasPrefix(node.ID, "../shared/types.d.ts#")
    case node.Kind == string(NodeModule) && node.File == "../shared/value.ts":
      module = node.Name == "../shared/value.ts" &&
        strings.Contains(node.ID, "#../shared/value.ts:module")
    case node.Kind == string(NodeFunction) && node.Name == "main":
      implemented = node.Implementation != nil && node.Implementation.File == "../shared/value.ts"
    }
  }
  if !internal || !external || !module || !implemented {
    t.Fatalf("portable node surfaces missing: internal=%t external=%t module=%t implementation=%t", internal, external, module, implemented)
  }
  for _, edge := range dump.Edges {
    if !ids[edge.From] || !ids[edge.To] {
      t.Fatalf("mapped edge endpoint is not a mapped node: %+v", edge)
    }
  }

  diagnostic := false
  for _, finding := range dump.Diagnostics {
    if finding.Code == 2322 && finding.File == "../shared/value.ts" {
      diagnostic = true
    }
  }
  if !diagnostic {
    t.Fatalf("sibling diagnostic did not use the shared coordinate: %+v", dump.Diagnostics)
  }

  source := false
  for _, entry := range dump.Provenance.Sources {
    if entry.File == "../shared/value.ts" {
      source = true
    }
  }
  if !source || len(dump.Provenance.Universe.Configs) != 1 ||
    dump.Provenance.Universe.Configs[0].File != "tsconfig.json" {
    t.Fatalf("manifest/config coordinates drifted: %+v", dump.Provenance)
  }
  roots := map[string]bool{}
  for _, root := range dump.Provenance.Universe.Roots {
    if root.Config != "tsconfig.json" {
      t.Fatalf("root config coordinate = %q", root.Config)
    }
    roots[root.File] = true
  }
  for _, want := range []string{"src/main.ts", "../shared/value.ts", "../shared/types.d.ts"} {
    if !roots[want] {
      t.Fatalf("universe roots omit %q: %+v", want, dump.Provenance.Universe.Roots)
    }
  }
}
