// Command rulecodes updates the append-only built-in diagnostic code ledger.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/samchon/ttsc/packages/lint/internal/rulecode"
	"github.com/samchon/ttsc/packages/lint/linthost"
)

func main() {
	root := flag.String("root", ".", "path to the packages/lint module")
	flag.Parse()

	ledgerPath := filepath.Join(*root, "linthost", "rule_codes.json")
	ledger := readLedger(ledgerPath)
	assigned, err := rulecode.Allocate(ledger, linthost.AllRuleNames())
	if err != nil {
		panic(err)
	}
	content, err := json.MarshalIndent(assigned, "", "  ")
	if err != nil {
		panic(err)
	}
	content = append(content, '\n')
	writeFile(ledgerPath, content)
}

func readLedger(path string) map[string]int32 {
	content, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	var ledger map[string]int32
	if err := json.Unmarshal(content, &ledger); err != nil {
		panic(fmt.Sprintf("parse %s: %v", path, err))
	}
	if len(ledger) == 0 {
		panic(fmt.Sprintf("%s is empty; restore it from version control before generation", path))
	}
	return ledger
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
