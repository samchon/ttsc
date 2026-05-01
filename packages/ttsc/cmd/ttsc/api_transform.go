package main

import (
	"encoding/json"
	"flag"
	"fmt"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

type apiTransformResult struct {
	Diagnostics []apiCompileDiagnostic `json:"diagnostics,omitempty"`
	TypeScript  map[string]string      `json:"typescript"`
}

func runAPITransform(args []string) int {
	fs := flag.NewFlagSet("api-transform", flag.ContinueOnError)
	fs.SetOutput(stderr)
	tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
	cwdOverride := fs.String("cwd", "", "override the working directory")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	cwd, ok := resolveBuildCwd(*cwdOverride)
	if !ok {
		return 2
	}

	prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
		ForceNoEmit: true,
	})
	if err != nil {
		fmt.Fprintf(stderr, "ttsc api-transform: %v\n", err)
		return 2
	}
	typescript := map[string]string{}
	if prog != nil {
		defer prog.Close()
		for _, file := range prog.SourceFiles() {
			typescript[apiOutputKey(cwd, file.FileName())] = file.Text()
		}
		diags = append(diags, prog.Diagnostics()...)
	}

	result := apiTransformResult{
		Diagnostics: make([]apiCompileDiagnostic, 0, len(diags)),
		TypeScript:  typescript,
	}
	for _, diag := range diags {
		result.Diagnostics = append(result.Diagnostics, toAPICompileDiagnostic(diag))
	}

	data, err := json.Marshal(result)
	if err != nil {
		fmt.Fprintf(stderr, "ttsc api-transform: result marshal failed: %v\n", err)
		return 3
	}
	fmt.Fprintln(stdout, string(data))
	if driver.CountErrors(diags) > 0 {
		return 2
	}
	return 0
}
