package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/samchon/ttsc/tests/go-transformer/transformer"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "ttsc-go-transformer: command is required")
		return 2
	}
	switch args[0] {
	case "-v", "--version", "version":
		fmt.Fprintln(os.Stdout, "ttsc-go-transformer 0.1.0-test")
		return 0
	case "transform":
		return runTransform(args[1:])
	case "build":
		return runBuild(args[1:])
	case "check":
		return runCheck(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "ttsc-go-transformer: unknown command %q\n", args[0])
		return 2
	}
}

func runCheck(args []string) int {
	fs := flag.NewFlagSet("check", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	_ = fs.String("cwd", "", "project directory")
	_ = fs.String("tsconfig", "", "tsconfig")
	_ = fs.String("rewrite-mode", "", "rewrite mode")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	return 0
}

func runBuild(args []string) int {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "project directory")
	_ = fs.String("tsconfig", "", "tsconfig")
	_ = fs.String("rewrite-mode", "", "rewrite mode")
	_ = fs.Bool("emit", false, "emit")
	_ = fs.Bool("quiet", false, "quiet")
	outDir := fs.String("outDir", "dist", "out dir")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	root := *cwd
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ttsc-go-transformer: cwd: %v\n", err)
			return 2
		}
	}
	source := filepath.Join(root, "src", "main.ts")
	text, err := os.ReadFile(source)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-go-transformer: read %s: %v\n", source, err)
		return 2
	}
	result, err := transformer.Transform(string(text))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	out := filepath.Join(root, *outDir, "main.js")
	if filepath.IsAbs(*outDir) {
		out = filepath.Join(*outDir, "main.js")
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-go-transformer: mkdir: %v\n", err)
		return 2
	}
	if err := os.WriteFile(out, []byte(result.Code), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-go-transformer: write %s: %v\n", out, err)
		return 2
	}
	return 0
}

func runTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "source file")
	out := fs.String("out", "", "output file")
	_ = fs.String("tsconfig", "", "owning tsconfig")
	_ = fs.String("rewrite-mode", "", "rewrite mode")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "ttsc-go-transformer: transform requires --file")
		return 2
	}
	source, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-go-transformer: read %s: %v\n", *file, err)
		return 2
	}
	result, err := transformer.Transform(string(source))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if *out != "" {
		if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "ttsc-go-transformer: mkdir: %v\n", err)
			return 2
		}
		if err := os.WriteFile(*out, []byte(result.Code), 0o644); err != nil {
			fmt.Fprintf(os.Stderr, "ttsc-go-transformer: write %s: %v\n", *out, err)
			return 2
		}
		return 0
	}
	fmt.Fprint(os.Stdout, result.Code)
	return 0
}
