package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpIsAFunctionOfTheSource pins the graph to the code it describes: two
// builds of one unedited snapshot must produce one byte-identical document.
//
// A private class member — `#count` — is bound under a mangled name carrying a
// counter that advances as the program is bound: `__#41@#count` in one run,
// `__#38@#count` in the next. If that counter reached the node id, and with it
// the wire, a handle given out in one session would name nothing after a
// restart, and no dump could be compared with another to prove that a change
// had left the facts alone.
//
// Two classes each declare a `#count`, so the mangling counter is exercised more
// than once and a per-class collision would surface here rather than in a
// three-million-line repository.
//
// 1. Load the same Counter private-member and Other private-member source in two independent programs.
// 2. Build and serialize each graph without sharing a builder.
// 3. Require byte-identical dumps; this checks deterministic identity, while the full-graph fixture owns structural correctness.
//
// @evidence contracts/testing.md#behavioral-verification Two independent compiler Programs and graph builders serialize the same authored declarations to identical dump bytes.
// @evidence contracts/testing.md#independent-expectations The fixture bytes are identical before either independent load, so deterministic identity and serialization require identical outputs. This equality oracle cannot establish that both outputs contain the correct structural facts; the full-graph fixture owns those literal assertions.
// @evidence contracts/testing.md#distinguishing-cases Independent loads of the same private-member source distinguish deterministic serialization from identities dependent on allocation or build history.
// @evidence contracts/testing.md#execution-ownership This Go source-unit entry loads and closes two actual Programs and calls Build and MarshalDump directly, without installing a consumer or building or starting a native product.
func TestDumpIsAFunctionOfTheSource(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Counter {
  #count = 0;
  #step: number;
  constructor(step: number) {
    this.#step = step;
  }
  bump(): number {
    this.#count += this.#step;
    return this.#count;
  }
}

export class Other {
  #count = 0;
  read(): number {
    return this.#count;
  }
}
`)

  first := dumpBytes(t, root)
  second := dumpBytes(t, root)
  if string(first) != string(second) {
    t.Fatalf("two dumps of one unedited snapshot differ: the graph is not a function of the source")
  }
}

func dumpBytes(t *testing.T, root string) []byte {
  t.Helper()
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  data, err := MarshalDump(Build(prog), root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{}, false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }
  return data
}
