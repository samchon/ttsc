package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpIsAFunctionOfTheSource pins the graph to the code it describes: two
// builds of one unedited snapshot must produce one byte-identical document.
//
// It did not. A private class member — `#count` — is bound under a mangled name
// carrying a counter that advances as the program is bound: `__#41@#count` in one
// run, `__#38@#count` in the next. That counter reached the node id, and with it
// the wire. On VS Code, 661 nodes and 661 edges changed identity between two
// dumps of the *same source*: a handle the model was given could name nothing
// after a restart, and no dump could be compared with another to prove that a
// change had left the facts alone — the byte test every graph optimisation is
// supposed to answer to was itself meaningless.
//
// Two classes each declare a `#count`, so the mangling counter is exercised more
// than once and a per-class collision would surface here rather than in a
// three-million-line repository.
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

  data, err := MarshalDump(Build(prog), root, "tsconfig.json", nil, SourceTexts(prog), false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }
  return data
}
