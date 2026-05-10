package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	shimprinter "github.com/microsoft/typescript-go/shim/printer"
	_ "github.com/samchon/ttsc/packages/ttsc/utility"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "go-source-plugin-managed-replace: command required")
		return 2
	}
	switch args[0] {
	case "build":
		return runBuild(args[1:])
	case "check":
		return 0
	case "version", "-v", "--version":
		fmt.Fprintln(os.Stdout, "go-source-plugin-managed-replace 0.0.0")
		return 0
	default:
		fmt.Fprintf(os.Stderr, "go-source-plugin-managed-replace: unknown command %q\n", args[0])
		return 2
	}
}

func runBuild(args []string) int {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	_ = fs.String("tsconfig", "", "")
	_ = fs.String("plugins-json", "", "")
	_ = fs.Bool("emit", false, "")
	_ = fs.Bool("quiet", false, "")
	_ = fs.Bool("verbose", false, "")
	_ = fs.Bool("noEmit", false, "")
	outDir := fs.String("outDir", "dist", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	root := *cwd
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
	}
	out := filepath.Join(root, *outDir, "main.js")
	if filepath.IsAbs(*outDir) {
		out = filepath.Join(*outDir, "main.js")
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code := fmt.Sprintf("%q;\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.value = %q;\n", "use strict", shimprinter.Marker())
	if err := os.WriteFile(out, []byte(code), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return 0
}
