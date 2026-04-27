package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var goUpperCall = regexp.MustCompile(`(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*goUpper\("([^"]*)"\)\s*;`)

type Plugin struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "go-source-plugin: command required")
		return 2
	}
	switch args[0] {
	case "-v", "--version", "version":
		fmt.Fprintln(os.Stdout, "go-source-plugin 0.0.0-test")
		return 0
	case "transform":
		return runTransform(args[1:])
	case "build":
		return runBuild(args[1:])
	case "check":
		return 0
	default:
		fmt.Fprintf(os.Stderr, "go-source-plugin: unknown command %q\n", args[0])
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
	pluginsJSON := fs.String("plugins-json", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "go-source-plugin: transform requires --file")
		return 2
	}
	plugins, err := parsePlugins(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	source, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "go-source-plugin: read %s: %v\n", *file, err)
		return 2
	}
	code, err := transform(string(source), plugins)
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
	pluginsJSON := fs.String("plugins-json", "", "")
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
	plugins, err := parsePlugins(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	source := filepath.Join(root, "src", "main.ts")
	text, err := os.ReadFile(source)
	if err != nil {
		fmt.Fprintf(os.Stderr, "go-source-plugin: read %s: %v\n", source, err)
		return 2
	}
	code, err := transform(string(text), plugins)
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

func parsePlugins(input string) ([]Plugin, error) {
	if input == "" {
		return nil, nil
	}
	var plugins []Plugin
	if err := json.Unmarshal([]byte(input), &plugins); err != nil {
		return nil, fmt.Errorf("go-source-plugin: invalid --plugins-json: %w", err)
	}
	return plugins, nil
}

func transform(source string, plugins []Plugin) (string, error) {
	match := goUpperCall.FindStringSubmatch(source)
	if match == nil {
		return "", fmt.Errorf(`go-source-plugin: expected export const value = goUpper("...")`)
	}
	name := match[1]
	value := match[2]
	if len(plugins) == 0 {
		plugins = []Plugin{{Mode: "go-uppercase"}}
	}
	for _, plugin := range plugins {
		switch plugin.Mode {
		case "go-uppercase":
			value = strings.ToUpper(value)
		case "go-lowercase":
			value = strings.ToLower(value)
		case "go-prefix":
			value = stringConfig(plugin.Config, "prefix") + value
		case "go-suffix":
			value += stringConfig(plugin.Config, "suffix")
		case "go-reverse":
			runes := []rune(value)
			for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
				runes[i], runes[j] = runes[j], runes[i]
			}
			value = string(runes)
		default:
			return "", fmt.Errorf("go-source-plugin: unsupported mode %q", plugin.Mode)
		}
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

func stringConfig(config map[string]any, key string) string {
	if config == nil {
		return ""
	}
	value, _ := config[key].(string)
	return value
}
