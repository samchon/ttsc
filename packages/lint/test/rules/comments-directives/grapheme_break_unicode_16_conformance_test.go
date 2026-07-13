package linthost

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// TestGraphemeBreakUnicode16Conformance verifies every Unicode 16.0.0
// extended-grapheme boundary published in GraphemeBreakTest.txt.
//
// A hand-picked regression set can still miss an entire UAX #29 property or
// left-context interaction. The official corpus checks each boundary, not only
// the final cluster count, and therefore locks the generated tables and the
// ordered GB3-GB999 implementation to the same normative Unicode release.
//
// 1. Parse every non-comment case from the vendored official corpus.
// 2. Compare each expected break/no-break marker with the streaming segmenter.
// 3. Assert the public length helper reports the resulting cluster count.
func TestGraphemeBreakUnicode16Conformance(t *testing.T) {
	corpusPath := filepath.Join("..", "test", "testdata", "unicode", graphemeUnicodeVersion, "GraphemeBreakTest.txt")
	corpus, err := os.Open(corpusPath)
	if err != nil {
		t.Fatalf("open %s: %v", corpusPath, err)
	}
	defer corpus.Close()

	scanner := bufio.NewScanner(corpus)
	lineNumber := 0
	testCases := 0
	for scanner.Scan() {
		lineNumber++
		data := strings.TrimSpace(strings.SplitN(scanner.Text(), "#", 2)[0])
		if data == "" {
			continue
		}
		fields := strings.Fields(data)
		if len(fields) < 3 || len(fields)%2 == 0 {
			t.Fatalf("line %d: malformed boundary sequence %q", lineNumber, data)
		}

		var text strings.Builder
		var segmenter graphemeSegmenter
		expectedClusters := 0
		for i := 1; i < len(fields); i += 2 {
			marker := fields[i-1]
			if marker != "\u00F7" && marker != "\u00D7" {
				t.Fatalf("line %d: unknown boundary marker %q", lineNumber, marker)
			}
			value, err := strconv.ParseInt(fields[i], 16, 32)
			if err != nil || value < 0 || value > 0x10FFFF {
				t.Fatalf("line %d: invalid code point %q", lineNumber, fields[i])
			}
			current := rune(value)
			properties := graphemeProperties(current)
			gotBoundary := segmenter.hasBoundaryBefore(properties)
			wantBoundary := marker == "\u00F7"
			if gotBoundary != wantBoundary {
				t.Fatalf(
					"line %d before U+%04X: want boundary=%v, got %v; case %q",
					lineNumber,
					current,
					wantBoundary,
					gotBoundary,
					data,
				)
			}
			if wantBoundary {
				expectedClusters++
			}
			segmenter.consume(properties)
			text.WriteRune(current)
		}
		if fields[len(fields)-1] != "\u00F7" {
			t.Fatalf("line %d: end of text must be a boundary, got %q", lineNumber, fields[len(fields)-1])
		}
		if got := stringLength(text.String()); got != expectedClusters {
			t.Fatalf("line %d: want %d clusters, got %d; case %q", lineNumber, expectedClusters, got, data)
		}
		testCases++
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan %s: %v", corpusPath, err)
	}
	if testCases == 0 {
		t.Fatal("official grapheme-break corpus contained no test cases")
	}
}
