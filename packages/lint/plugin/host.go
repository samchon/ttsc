// Bootstrap glue for the @ttsc/lint native binary.
//
// We don't import `github.com/samchon/ttsc/packages/ttsc/driver` from a
// source plugin because that would force every consumer of @ttsc/lint to
// have the in-tree samchon/ttsc/packages/ttsc module on their go.work — a
// dependency the public proxy cannot satisfy and that conflicts with
// ttsc's runtime-generated go.work overlay. Instead, this file inlines a
// minimal Program/Checker bootstrap (the same pattern documented in
// 03-tsgo.md and used by every other source-plugin reference fixture).
package main

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/bundled"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	"github.com/microsoft/typescript-go/shim/tsoptions"
	"github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
	"github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// program bundles the tsgo Program with the parsed config and a checker
// release callback so the orchestration code can clean up after itself.
type program struct {
	cwd            string
	tsProgram      *shimcompiler.Program
	parsed         *tsoptions.ParsedCommandLine
	checker        *shimchecker.Checker
	releaseChecker func()
}

type loadProgramOptions struct {
	forceEmit   bool
	forceNoEmit bool
	outDir      string
}

// loadProgram parses the given tsconfig, builds a Program, and acquires a
// type checker. Mirrors the canonical bootstrap pattern from
// `03-tsgo.md` — the only ttsc-specific bit is that `forceEmit`/
// `forceNoEmit`/`outDir` overrides are merged into the parsed config
// before the program is created so `--noEmit` and friends behave like
// they do in `ttsc check`.
func loadProgram(cwd, tsconfigPath string, options loadProgramOptions) (*program, []*shimast.Diagnostic, error) {
	if !filepath.IsAbs(cwd) {
		abs, err := filepath.Abs(cwd)
		if err != nil {
			return nil, nil, fmt.Errorf("loadProgram: cwd: %w", err)
		}
		cwd = abs
	}
	resolved := tsconfigPath
	if !filepath.IsAbs(resolved) {
		resolved = filepath.Join(cwd, resolved)
	}

	fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
	host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)

	parsed, parseDiags := tsoptions.GetParsedCommandLineOfConfigFile(
		resolved,
		&shimcore.CompilerOptions{},
		nil,
		host,
		nil,
	)
	if parsed == nil {
		return nil, nil, fmt.Errorf("tsoptions: parsed command line was nil for %s", resolved)
	}
	if len(parseDiags) > 0 {
		return nil, parseDiags, nil
	}
	if len(parsed.Errors) > 0 {
		return nil, parsed.Errors, nil
	}
	if options.forceNoEmit {
		forceNoEmit(parsed)
	}
	if options.forceEmit {
		forceEmit(parsed)
	}
	if options.outDir != "" {
		overrideOutDir(cwd, parsed, options.outDir)
	}

	tsProgram := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
		Config:                      parsed,
		SingleThreaded:              shimcore.TSTrue,
		Host:                        host,
		UseSourceOfProjectReference: true,
	})
	if tsProgram == nil {
		return nil, nil, errors.New("compiler.NewProgram returned nil")
	}
	checker, release := tsProgram.GetTypeChecker(context.Background())
	return &program{
		cwd:            cwd,
		tsProgram:      tsProgram,
		parsed:         parsed,
		checker:        checker,
		releaseChecker: release,
	}, nil, nil
}

func (p *program) close() {
	if p == nil {
		return
	}
	if p.releaseChecker != nil {
		p.releaseChecker()
		p.releaseChecker = nil
	}
}

// userSourceFiles returns the program's user-authored source files
// (declaration files filtered out — those belong to library typings).
func (p *program) userSourceFiles() []*shimast.SourceFile {
	out := make([]*shimast.SourceFile, 0)
	for _, f := range p.tsProgram.SourceFiles() {
		if f == nil || f.IsDeclarationFile {
			continue
		}
		out = append(out, f)
	}
	return out
}

// programDiagnostics returns the bind + semantic diagnostics for the
// loaded program. Same surface tsgo's CLI prints when you run a regular
// `tsgo --noEmit`.
func (p *program) programDiagnostics() []*shimast.Diagnostic {
	if p == nil || p.tsProgram == nil {
		return nil
	}
	ctx := context.Background()
	raw := shimcompiler.GetDiagnosticsOfAnyProgram(
		ctx,
		p.tsProgram,
		nil,
		false,
		p.tsProgram.GetBindDiagnostics,
		p.tsProgram.GetSemanticDiagnostics,
	)
	return shimcompiler.SortAndDeduplicateDiagnostics(raw)
}

// findSourceFile locates a source file in the program by absolute path.
// tsgo normalizes paths to forward slashes; we do the same on our side.
func (p *program) findSourceFile(target string) *shimast.SourceFile {
	want := filepath.ToSlash(target)
	for _, file := range p.tsProgram.SourceFiles() {
		if filepath.ToSlash(file.FileName()) == want {
			return file
		}
	}
	return nil
}

func forceEmit(parsed *tsoptions.ParsedCommandLine) {
	if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
		return
	}
	options := parsed.ParsedConfig.CompilerOptions
	options.NoEmit = shimcore.TSFalse
	options.EmitDeclarationOnly = shimcore.TSFalse
}

func forceNoEmit(parsed *tsoptions.ParsedCommandLine) {
	if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
		return
	}
	parsed.ParsedConfig.CompilerOptions.NoEmit = shimcore.TSTrue
}

func overrideOutDir(cwd string, parsed *tsoptions.ParsedCommandLine, outDir string) {
	if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
		return
	}
	if filepath.IsAbs(outDir) {
		parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(outDir)
		return
	}
	parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(filepath.Join(cwd, outDir))
}
