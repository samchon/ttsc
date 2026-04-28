package lint_test

import (
	"strings"
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestOutputPipelineBanner(t *testing.T) {
	pipeline, err := lintpkg.NewOutputPipeline([]lintpkg.PluginEntry{
		{
			Mode:   "ttsc-banner",
			Config: map[string]any{"banner": "/*! test */"},
		},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	out, err := pipeline.Apply("/project/dist/main.js", `"use strict";`+"\n")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "/*! test */\n") {
		t.Fatalf("banner was not prepended:\n%s", out)
	}
}

func TestOutputPipelineStrip(t *testing.T) {
	pipeline, err := lintpkg.NewOutputPipeline([]lintpkg.PluginEntry{
		{
			Mode: "ttsc-strip",
			Config: map[string]any{
				"calls":      []any{"console.log", "console.debug", "assert.*"},
				"statements": []any{"debugger"},
			},
		},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	out, err := pipeline.Apply("/project/dist/main.js", strings.Join([]string{
		`"use strict";`,
		`debugger;`,
		`console.log("drop");`,
		`console.debug("drop");`,
		`assert.equal(1, 1);`,
		`process.stdout.write("keep");`,
		``,
	}, "\n"))
	if err != nil {
		t.Fatal(err)
	}
	for _, dropped := range []string{"debugger", "console.log", "console.debug", "assert.equal"} {
		if strings.Contains(out, dropped) {
			t.Fatalf("expected %q to be stripped from:\n%s", dropped, out)
		}
	}
	if !strings.Contains(out, `process.stdout.write("keep")`) {
		t.Fatalf("expected non-matching call to stay:\n%s", out)
	}
}

func TestOutputPipelineRejectsInvalidStripConfig(t *testing.T) {
	_, err := lintpkg.NewOutputPipeline([]lintpkg.PluginEntry{
		{
			Mode: "ttsc-strip",
			Config: map[string]any{
				"calls": []any{"console.*.bad"},
			},
		},
	}, nil)
	if err == nil || !strings.Contains(err.Error(), "wildcard is only supported at the end") {
		t.Fatalf("expected wildcard error, got %v", err)
	}
}
