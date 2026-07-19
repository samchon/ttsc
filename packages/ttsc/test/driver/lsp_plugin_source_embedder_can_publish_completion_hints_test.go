package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type completionHintPluginSource struct {
  driver.PluginSource
}

func (*completionHintPluginSource) CompletionHints() []driver.LSPCompletionHint {
  return []driver.LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@evidence ",
    Items: []driver.LSPCompletionItem{{
      Insert: "docs/spec.md",
      Label:  "spec",
      Detail: "Evidence specification",
    }},
  }}
}

var _ driver.PluginSource = (*completionHintPluginSource)(nil)
var _ driver.CompletionHintSource = (*completionHintPluginSource)(nil)

// TestLSPPluginSourceEmbedderCanPublishCompletionHints verifies an external
// driver consumer can add the proxy's optional completion-hint capability
// while importing only the public driver package.
//
// 1. Embed a public PluginSource backed by NullPluginSource.
// 2. Publish hints using the public completion aliases.
// 3. Assert the optional public interface exposes the complete hint payload.
func TestLSPPluginSourceEmbedderCanPublishCompletionHints(t *testing.T) {
  source := &completionHintPluginSource{
    PluginSource: driver.NullPluginSource{},
  }

  hints := source.CompletionHints()
  if len(hints) != 1 {
    t.Fatalf("CompletionHints length: want 1, got %d", len(hints))
  }
  if hints[0].Scope != "jsdoc" || hints[0].After != "@evidence " {
    t.Fatalf("CompletionHints trigger: want jsdoc/@evidence, got %#v", hints[0])
  }
  if len(hints[0].Items) != 1 || hints[0].Items[0].Insert != "docs/spec.md" {
    t.Fatalf("CompletionHints items: want docs/spec.md, got %#v", hints[0].Items)
  }
}
