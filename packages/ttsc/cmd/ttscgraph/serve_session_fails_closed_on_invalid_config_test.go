package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestServeSessionFailsClosedOnInvalidConfig verifies a broken project config
// never falls back to the last valid graph and recovers after the config is fixed.
//
// Returning stale compiler facts is worse than returning an MCP error. A config
// parse failure must therefore suppress the dump while preserving enough
// session state to retry the reload on the next request.
//
// 1. Build a valid initial graph, then replace tsconfig.json with invalid JSON.
// 2. Assert snapshot fails with no dump instead of serving the cached graph.
// 3. Restore a valid config and assert the next request reloads successfully.
func TestServeSessionFailsClosedOnInvalidConfig(t *testing.T) {
	root := graphSessionFixture(t)
	session, err := newGraphSession(root, "tsconfig.json")
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	if _, _, _, err := session.Snapshot(); err != nil {
		t.Fatal(err)
	}

	config := filepath.Join(root, "tsconfig.json")
	if err := os.WriteFile(config, []byte("{ invalid"), 0o644); err != nil {
		t.Fatal(err)
	}
	dump, _, changed, err := session.Snapshot()
	if err == nil || dump != nil || changed {
		t.Fatalf("invalid config must fail closed: dump:%v changed:%v err:%v", dump != nil, changed, err)
	}

	valid := `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`
	if err := os.WriteFile(config, []byte(valid), 0o644); err != nil {
		t.Fatal(err)
	}
	dump, mode, changed, err := session.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "BeforeEdit") {
		t.Fatalf("fixed config did not recover: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
	}
}
