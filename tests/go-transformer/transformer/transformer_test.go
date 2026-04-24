package transformer

import (
	"strings"
	"testing"
)

func TestTransformGoUpper(t *testing.T) {
	result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Code, `"HELLO"`) {
		t.Fatalf("expected transformed literal, got:\n%s", result.Code)
	}
}
