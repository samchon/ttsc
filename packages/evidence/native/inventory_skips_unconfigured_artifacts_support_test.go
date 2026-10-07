package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// decodeInventoryConfig decodes a graph and anchors it, the way Check does.
//
// The anchoring is not incidental. A loader walks a population's resolved base,
// and decoding alone leaves that base empty — so a case that skipped this step
// would exercise a configuration no consumer can produce.
func decodeInventoryConfig(t *testing.T, root string, raw string) graphConfig {
  t.Helper()
  config, problems := decodeGraphConfig(json.RawMessage(raw))
  if len(problems) != 0 {
    t.Fatalf("configuration must decode cleanly, got: %v", problems)
  }
  resolveGraphBases(root, &config)
  return config
}

func writeInventoryFixture(t *testing.T, relative string, content string) string {
  t.Helper()
  root := t.TempDir()
  absolute := filepath.Join(root, filepath.FromSlash(relative))
  if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
  return root
}
