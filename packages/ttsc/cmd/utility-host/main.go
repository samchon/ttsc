package main

import (
	"fmt"
	"os"

	"github.com/samchon/ttsc/packages/ttsc/utility"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		return utility.RunBuild(nil)
	}
	switch args[0] {
	case "build":
		return utility.RunBuild(args[1:])
	case "check":
		return utility.RunCheck(args[1:])
	case "transform":
		return utility.RunTransform(args[1:])
	case "-h", "--help", "help":
		printHelp()
		return 0
	default:
		fmt.Fprintf(os.Stderr, "ttsc utility: unknown command %q\n", args[0])
		fmt.Fprintln(os.Stderr, `ttsc utility: run "help" to see supported commands`)
		return 2
	}
}

func printHelp() {
	fmt.Fprintln(os.Stdout, `ttsc utility host

Usage:
  utility-host build --tsconfig=tsconfig.json --plugins-json='[...]'
  utility-host check --tsconfig=tsconfig.json --plugins-json='[...]'
  utility-host transform --tsconfig=tsconfig.json --plugins-json='[...]'`)
}
