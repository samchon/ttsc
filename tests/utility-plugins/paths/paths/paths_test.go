package paths

import (
	"strings"
	"testing"
)

func TestApplyRewritesCommonJSRequire(t *testing.T) {
	resolver := testResolver()
	out, err := resolver.apply("/project/dist/main.js", `const message = require("@lib/message");`+"\n")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `require("./modules/message.js")`) {
		t.Fatalf("require specifier was not rewritten:\n%s", out)
	}
}

func TestApplyRewritesDeclarationImportTypes(t *testing.T) {
	resolver := testResolver()
	out, err := resolver.apply("/project/dist/main.d.ts", `export type Box = import("@lib/message").MessageBox;`+"\n")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `import("./modules/message.js")`) {
		t.Fatalf("declaration import type was not rewritten:\n%s", out)
	}
}

func TestRewriteUsesExactPatternBeforeWildcard(t *testing.T) {
	resolver := testResolver()
	rewritten, ok := resolver.rewriteSpecifier("/project/dist/main.js", "@lib/exact")
	if !ok {
		t.Fatal("expected exact pattern to rewrite")
	}
	if rewritten != "./modules/exact.js" {
		t.Fatalf("unexpected rewrite: %s", rewritten)
	}
}

func TestApplyLeavesExternalAndRelativeSpecifiers(t *testing.T) {
	resolver := testResolver()
	text := strings.Join([]string{
		`import fs from "node:fs";`,
		`import local from "./local.js";`,
		``,
	}, "\n")
	out, err := resolver.apply("/project/dist/main.js", text)
	if err != nil {
		t.Fatal(err)
	}
	if out != text {
		t.Fatalf("external/relative specifiers should stay unchanged:\n%s", out)
	}
}

func testResolver() *pathsResolver {
	return &pathsResolver{
		basePath: "/project",
		outDir:   "/project/dist",
		rootDir:  "/project/src",
		patterns: []pathsPattern{
			{pattern: "@lib/exact", targets: []string{"./src/modules/exact.ts"}},
			{pattern: "@lib/*", targets: []string{"./src/missing/*", "./src/modules/*"}},
		},
		sourceFiles: map[string]string{
			"/project/src/modules/exact.ts":   "/project/src/modules/exact.ts",
			"/project/src/modules/exact":      "/project/src/modules/exact.ts",
			"/project/src/modules/message.ts": "/project/src/modules/message.ts",
			"/project/src/modules/message":    "/project/src/modules/message.ts",
		},
	}
}
