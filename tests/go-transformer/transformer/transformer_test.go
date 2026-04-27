package transformer

import (
	"strings"
	"testing"
)

func TestTransformGoUpper(t *testing.T) {
	result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`, []Plugin{
		{Mode: "go-uppercase"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Code, `"HELLO"`) {
		t.Fatalf("expected transformed literal, got:\n%s", result.Code)
	}
}

func TestTransformOrderedPlugins(t *testing.T) {
	result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`, []Plugin{
		{Mode: "go-prefix", Config: map[string]any{"prefix": "A:"}},
		{Mode: "go-uppercase"},
		{Mode: "go-suffix", Config: map[string]any{"suffix": ":Z"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Code, `"A:HELLO:Z"`) {
		t.Fatalf("expected ordered plugin output, got:\n%s", result.Code)
	}
}
