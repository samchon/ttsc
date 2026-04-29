package main

import (
	"strings"
	"testing"
)

func TestApplyPrependsBannerToJavaScript(t *testing.T) {
	out, err := Apply("/project/dist/main.js", `"use strict";`+"\n", map[string]any{
		"banner": "/*! test */",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "/*! test */\n") {
		t.Fatalf("banner was not prepended:\n%s", out)
	}
}

func TestApplyPrependsBannerToDeclarations(t *testing.T) {
	out, err := Apply("/project/dist/main.d.ts", `export {};`+"\n", map[string]any{
		"banner": "/*! types */",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "/*! types */\n") {
		t.Fatalf("banner was not prepended to declaration:\n%s", out)
	}
}

func TestApplyRejectsMissingBanner(t *testing.T) {
	_, err := Apply("/project/dist/main.js", `console.log(1);`, map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "non-empty string") {
		t.Fatalf("expected banner config error, got %v", err)
	}
}

func TestApplySkipsSourceMaps(t *testing.T) {
	const text = `{"version":3}`
	out, err := Apply("/project/dist/main.js.map", text, map[string]any{
		"banner": "/*! test */",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out != text {
		t.Fatalf("source map should be unchanged: %q", out)
	}
}
