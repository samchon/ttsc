package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	shimcore "github.com/microsoft/typescript-go/shim/core"
)

var goUpperCall = regexp.MustCompile(`(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*goUpper\("([^"]*)"\)\s*;`)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "go-source-plugin-tsgo: command required")
		return 2
	}
	switch args[0] {
	case "transform":
		return runTransform(args[1:])
	case "build":
		return runBuild(args[1:])
	case "check":
		return 0
	case "version", "-v", "--version":
		fmt.Fprintln(os.Stdout, "go-source-plugin-tsgo 0.0.0")
		return 0
	default:
		fmt.Fprintf(os.Stderr, "go-source-plugin-tsgo: unknown command %q\n", args[0])
		return 2
	}
}

func runTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "")
	out := fs.String("out", "", "")
	_ = fs.String("tsconfig", "", "")
	_ = fs.String("rewrite-mode", "", "")
	_ = fs.String("plugins-json", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	source, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code, err := transform(string(source))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if *out != "" {
		if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		if err := os.WriteFile(*out, []byte(code), 0o644); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		return 0
	}
	fmt.Fprint(os.Stdout, code)
	return 0
}

func runBuild(args []string) int {
	fs := flag.NewFlagSet("build", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	_ = fs.String("tsconfig", "", "")
	_ = fs.String("rewrite-mode", "", "")
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
	source := filepath.Join(root, "src", "main.ts")
	text, err := os.ReadFile(source)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code, err := transform(string(text))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	out := filepath.Join(root, *outDir, "main.js")
	if filepath.IsAbs(*outDir) {
		out = filepath.Join(*outDir, "main.js")
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if err := os.WriteFile(out, []byte(code), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return 0
}

// transform exercises a real tsgo shim symbol so that this binary cannot
// compile unless ttsc's go.work overlay has wired the shim modules in.
func transform(source string) (string, error) {
	match := goUpperCall.FindStringSubmatch(source)
	if match == nil {
		return "", fmt.Errorf(`go-source-plugin-tsgo: expected goUpper("...")`)
	}
	name := match[1]
	value := strings.ToUpper(match[2])
	if shimcore.TSTrue != shimcore.TSFalse {
		value += " (tsgo)"
	}
	var b strings.Builder
	b.WriteString(`"use strict";` + "\n")
	b.WriteString(`Object.defineProperty(exports, "__esModule", { value: true });` + "\n")
	b.WriteString(fmt.Sprintf("exports.%s = void 0;\n", name))
	b.WriteString(fmt.Sprintf("const %s = %q;\n", name, value))
	b.WriteString(fmt.Sprintf("exports.%s = %s;\n", name, name))
	if strings.Contains(source, "console.log("+name+")") || strings.Contains(source, "console.log("+name+");") {
		b.WriteString(fmt.Sprintf("console.log(%s);\n", name))
	}
	return b.String(), nil
}
