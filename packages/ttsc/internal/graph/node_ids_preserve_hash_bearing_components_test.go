package graph

import (
  "path/filepath"
  "testing"
)

// TestNodeIDsPreserveHashBearingComponents verifies graph identity: quoted
// path and symbol hashes remain structured facts through dump relativization.
//
// A source path and an authored private member may both contain '#'. Splitting
// the display id at either raw occurrence made the dump lose its project
// relative path and made consumers read the member as an id separator. The
// codec must escape those components while keeping ordinary ids byte-identical.
//
//  1. Build ordinary and hash-bearing ids from their raw structured facts.
//  2. Relativize the hash-bearing id as the dump does.
//  3. Recover its raw file component and assert the escaped wire spelling.
func TestNodeIDsPreserveHashBearingComponents(t *testing.T) {
  if got, want := nodeID("src/main.ts", "main", NodeFunction), "src/main.ts#main:function"; got != want {
    t.Fatalf("ordinary id = %q, want %q", got, want)
  }
  if got, want := nodeID(`C:\work\a#b\main.ts`, "label:part", NodeVariable), `C:\\work\\a\#b\\main.ts#label:part:variable`; got != want {
    t.Fatalf("escaped id = %q, want %q", got, want)
  } else if parts, ok := parseNodeID(got); !ok || parts.path != `C:\work\a#b\main.ts` || parts.name != "label:part" {
    t.Fatalf("decoded id = %#v, %t; want raw path and name", parts, ok)
  }

  root := filepath.Join(t.TempDir(), "a#b")
  file := filepath.Join(root, "src#generated", "main#file.ts")
  id := nodeID(file, "Counter.#count", NodeVariable)
  context := newDumpContext(root, nil)
  got := context.relID(id)
  want := "src\\#generated/main\\#file.ts#Counter.\\#count:variable"
  if got != want {
    t.Fatalf("relativized id = %q, want %q", got, want)
  }
  if file := nodeFile(got); file != "src#generated/main#file.ts" {
    t.Fatalf("decoded file = %q, want raw hash-bearing relative path", file)
  }
}
