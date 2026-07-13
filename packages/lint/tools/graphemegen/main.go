package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/format"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	unicodeVersion = "16.0.0"
	unicodeBaseURL = "https://www.unicode.org/Public/" + unicodeVersion + "/ucd/"
)

type propertyRange struct {
	lo       rune
	hi       rune
	constant string
}

func main() {
	root := flag.String("root", ".", "path to the packages/lint module")
	flag.Parse()

	graphemeBreakData := fetch("auxiliary/GraphemeBreakProperty.txt")
	derivedCoreData := fetch("DerivedCoreProperties.txt")
	emojiData := fetch("emoji/emoji-data.txt")
	graphemeBreakTest := fetch("auxiliary/GraphemeBreakTest.txt")

	requireMarker("GraphemeBreakProperty.txt", graphemeBreakData, "GraphemeBreakProperty-"+unicodeVersion+".txt")
	requireMarker("DerivedCoreProperties.txt", derivedCoreData, "DerivedCoreProperties-"+unicodeVersion+".txt")
	requireMarker("emoji-data.txt", emojiData, "Emoji Version 16.0")
	requireMarker("GraphemeBreakTest.txt", graphemeBreakTest, "GraphemeBreakTest-"+unicodeVersion+".txt")

	graphemeBreakRanges := parseGraphemeBreakProperties(graphemeBreakData)
	indicConjunctBreakRanges := parseIndicConjunctBreakProperties(derivedCoreData)
	extendedPictographicRanges := parseExtendedPictographicProperties(emojiData)

	generated := renderTables(
		graphemeBreakRanges,
		indicConjunctBreakRanges,
		extendedPictographicRanges,
	)
	writeFile(filepath.Join(*root, "linthost", "grapheme_tables_gen.go"), generated)
	writeFile(
		filepath.Join(*root, "test", "testdata", "unicode", unicodeVersion, "GraphemeBreakTest.txt"),
		graphemeBreakTest,
	)
}

func fetch(relativeURL string) []byte {
	client := &http.Client{Timeout: 30 * time.Second}
	request, err := http.NewRequest(http.MethodGet, unicodeBaseURL+relativeURL, nil)
	if err != nil {
		panic(err)
	}
	request.Header.Set("User-Agent", "ttsc-grapheme-table-generator")
	response, err := client.Do(request)
	if err != nil {
		panic(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("GET %s: %s", request.URL, response.Status))
	}
	content, err := io.ReadAll(response.Body)
	if err != nil {
		panic(err)
	}
	return content
}

func requireMarker(name string, content []byte, marker string) {
	if !bytes.Contains(content, []byte(marker)) {
		panic(fmt.Sprintf("%s does not contain expected version marker %q", name, marker))
	}
}

func parseGraphemeBreakProperties(content []byte) []propertyRange {
	constants := map[string]string{
		"CR":                 "graphemeBreakCR",
		"LF":                 "graphemeBreakLF",
		"Control":            "graphemeBreakControl",
		"Extend":             "graphemeBreakExtend",
		"Regional_Indicator": "graphemeBreakRegionalIndicator",
		"Prepend":            "graphemeBreakPrepend",
		"SpacingMark":        "graphemeBreakSpacingMark",
		"L":                  "graphemeBreakL",
		"V":                  "graphemeBreakV",
		"T":                  "graphemeBreakT",
		"LV":                 "graphemeBreakLV",
		"LVT":                "graphemeBreakLVT",
		"ZWJ":                "graphemeBreakZWJ",
	}
	var ranges []propertyRange
	forEachDataLine(content, func(fields []string) {
		if len(fields) != 2 {
			panic(fmt.Sprintf("unexpected GraphemeBreakProperty fields: %q", fields))
		}
		constant, ok := constants[fields[1]]
		if !ok {
			panic(fmt.Sprintf("unknown Grapheme_Cluster_Break value %q", fields[1]))
		}
		lo, hi := parseCodePointRange(fields[0])
		ranges = append(ranges, propertyRange{lo: lo, hi: hi, constant: constant})
	})
	return normalizeRanges("Grapheme_Cluster_Break", ranges)
}

func parseIndicConjunctBreakProperties(content []byte) []propertyRange {
	constants := map[string]string{
		"Consonant": "indicConjunctBreakConsonant",
		"Extend":    "indicConjunctBreakExtend",
		"Linker":    "indicConjunctBreakLinker",
	}
	var ranges []propertyRange
	forEachDataLine(content, func(fields []string) {
		if len(fields) < 2 || fields[1] != "InCB" {
			return
		}
		if len(fields) != 3 {
			panic(fmt.Sprintf("unexpected Indic_Conjunct_Break fields: %q", fields))
		}
		constant, ok := constants[fields[2]]
		if !ok {
			panic(fmt.Sprintf("unknown Indic_Conjunct_Break value %q", fields[2]))
		}
		lo, hi := parseCodePointRange(fields[0])
		ranges = append(ranges, propertyRange{lo: lo, hi: hi, constant: constant})
	})
	return normalizeRanges("Indic_Conjunct_Break", ranges)
}

func parseExtendedPictographicProperties(content []byte) []propertyRange {
	var ranges []propertyRange
	forEachDataLine(content, func(fields []string) {
		if len(fields) != 2 || fields[1] != "Extended_Pictographic" {
			return
		}
		lo, hi := parseCodePointRange(fields[0])
		ranges = append(ranges, propertyRange{lo: lo, hi: hi})
	})
	return normalizeRanges("Extended_Pictographic", ranges)
}

func forEachDataLine(content []byte, visit func([]string)) {
	for _, rawLine := range strings.Split(string(content), "\n") {
		line := strings.TrimSpace(strings.SplitN(rawLine, "#", 2)[0])
		if line == "" {
			continue
		}
		parts := strings.Split(line, ";")
		fields := make([]string, len(parts))
		for i, part := range parts {
			fields[i] = strings.TrimSpace(part)
		}
		visit(fields)
	}
}

func parseCodePointRange(text string) (rune, rune) {
	parts := strings.Split(text, "..")
	if len(parts) > 2 {
		panic(fmt.Sprintf("invalid code-point range %q", text))
	}
	lo := parseCodePoint(parts[0])
	hi := lo
	if len(parts) == 2 {
		hi = parseCodePoint(parts[1])
	}
	if hi < lo {
		panic(fmt.Sprintf("descending code-point range %q", text))
	}
	return lo, hi
}

func parseCodePoint(text string) rune {
	value, err := strconv.ParseInt(strings.TrimSpace(text), 16, 32)
	if err != nil || value < 0 || value > 0x10FFFF {
		panic(fmt.Sprintf("invalid code point %q", text))
	}
	return rune(value)
}

func normalizeRanges(name string, ranges []propertyRange) []propertyRange {
	if len(ranges) == 0 {
		panic(name + " produced no ranges")
	}
	sort.Slice(ranges, func(i, j int) bool {
		if ranges[i].lo != ranges[j].lo {
			return ranges[i].lo < ranges[j].lo
		}
		return ranges[i].hi < ranges[j].hi
	})
	merged := make([]propertyRange, 0, len(ranges))
	for _, current := range ranges {
		if len(merged) > 0 {
			previous := &merged[len(merged)-1]
			if current.lo <= previous.hi {
				panic(fmt.Sprintf("%s has overlapping ranges U+%04X..U+%04X and U+%04X..U+%04X", name, previous.lo, previous.hi, current.lo, current.hi))
			}
			if current.lo == previous.hi+1 && current.constant == previous.constant {
				previous.hi = current.hi
				continue
			}
		}
		merged = append(merged, current)
	}
	return merged
}

func renderTables(graphemeBreak, indicConjunctBreak, extendedPictographic []propertyRange) []byte {
	var out bytes.Buffer
	out.WriteString("// Code generated by packages/lint/tools/graphemegen. DO NOT EDIT.\n")
	out.WriteString("//\n")
	out.WriteString("// Derived from the Unicode Character Database and UAX #29 test data for Unicode ")
	out.WriteString(unicodeVersion)
	out.WriteString(".\n")
	out.WriteString("// Sources: GraphemeBreakProperty.txt, DerivedCoreProperties.txt, and emoji-data.txt.\n")
	out.WriteString("// Unicode data terms: https://www.unicode.org/license.txt\n\n")
	out.WriteString("package linthost\n\n")
	out.WriteString("const graphemeUnicodeVersion = \"")
	out.WriteString(unicodeVersion)
	out.WriteString("\"\n\n")
	out.WriteString(`type graphemeBreakClass uint8

const (
	graphemeBreakOther graphemeBreakClass = iota
	graphemeBreakCR
	graphemeBreakLF
	graphemeBreakControl
	graphemeBreakExtend
	graphemeBreakRegionalIndicator
	graphemeBreakPrepend
	graphemeBreakSpacingMark
	graphemeBreakL
	graphemeBreakV
	graphemeBreakT
	graphemeBreakLV
	graphemeBreakLVT
	graphemeBreakZWJ
)

type indicConjunctBreakClass uint8

const (
	indicConjunctBreakNone indicConjunctBreakClass = iota
	indicConjunctBreakConsonant
	indicConjunctBreakExtend
	indicConjunctBreakLinker
)

type graphemeBreakRange struct {
	lo    rune
	hi    rune
	class graphemeBreakClass
}

type indicConjunctBreakRange struct {
	lo    rune
	hi    rune
	class indicConjunctBreakClass
}

type unicodeRange struct {
	lo rune
	hi rune
}

`)
	renderPropertyRanges(&out, "graphemeBreakRanges", "graphemeBreakRange", graphemeBreak, true)
	renderPropertyRanges(&out, "indicConjunctBreakRanges", "indicConjunctBreakRange", indicConjunctBreak, true)
	renderPropertyRanges(&out, "extendedPictographicRanges", "unicodeRange", extendedPictographic, false)

	formatted, err := format.Source(out.Bytes())
	if err != nil {
		panic(fmt.Sprintf("format generated tables: %v\n%s", err, out.String()))
	}
	return formatted
}

func renderPropertyRanges(out *bytes.Buffer, name, rangeType string, ranges []propertyRange, includeClass bool) {
	fmt.Fprintf(out, "var %s = [...]%s{\n", name, rangeType)
	for _, value := range ranges {
		if includeClass {
			fmt.Fprintf(out, "\t{lo: 0x%04X, hi: 0x%04X, class: %s},\n", value.lo, value.hi, value.constant)
		} else {
			fmt.Fprintf(out, "\t{lo: 0x%04X, hi: 0x%04X},\n", value.lo, value.hi)
		}
	}
	out.WriteString("}\n\n")
}

func writeFile(path string, content []byte) {
	if existing, err := os.ReadFile(path); err == nil && bytes.Equal(existing, content) {
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		panic(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		panic(err)
	}
}
