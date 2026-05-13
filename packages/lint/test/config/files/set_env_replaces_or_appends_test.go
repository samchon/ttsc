package main

import "testing"

// TestSetEnvReplacesOrAppends verifies environment overlays are deterministic.
//
// JavaScript config loading builds a node subprocess environment. setEnv is the
// small helper that updates NODE_PATH without duplicating keys, so it must
// replace existing values and append missing ones predictably.
//
// This scenario covers both branches directly because command-level tests only
// observe the final subprocess behavior.
//
// 1. Replace an existing KEY entry in an environment slice.
// 2. Append a missing NEXT entry to the same slice.
// 3. Assert ordering and values stay stable.
func TestSetEnvReplacesOrAppends(t *testing.T) {
  replaced := setEnv([]string{"A=1", "KEY=old"}, "KEY", "new")
  if len(replaced) != 2 || replaced[1] != "KEY=new" {
    t.Fatalf("replace mismatch: %v", replaced)
  }
  appended := setEnv(replaced, "NEXT", "value")
  if len(appended) != 3 || appended[2] != "NEXT=value" {
    t.Fatalf("append mismatch: %v", appended)
  }
}
