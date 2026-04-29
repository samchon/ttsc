package main

import (
	"fmt"
	"os"

	"github.com/samchon/ttsc/packages/strip/go-plugin/strip"
)

const version = "0.0.1"

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "@ttsc/strip: command required (expected output|version)")
		return 2
	}
	switch args[0] {
	case "-v", "--version", "version":
		fmt.Fprintf(os.Stdout, "@ttsc/strip %s\n", version)
		return 0
	case "check":
		return 0
	case "output":
		return strip.RunOutput(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "@ttsc/strip: unknown command %q\n", args[0])
		return 2
	}
}
