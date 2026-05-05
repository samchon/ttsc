package compiler

import (
	"context"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/binder"
	innercompiler "github.com/microsoft/typescript-go/internal/compiler"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/diagnostics"
	"github.com/microsoft/typescript-go/internal/module"
	"github.com/microsoft/typescript-go/internal/outputpaths"
	"github.com/microsoft/typescript-go/internal/packagejson"
	"github.com/microsoft/typescript-go/internal/printer"
	"github.com/microsoft/typescript-go/internal/sourcemap"
	"github.com/microsoft/typescript-go/internal/stringutil"
	"github.com/microsoft/typescript-go/internal/symlinks"
	"github.com/microsoft/typescript-go/internal/transformers"
	"github.com/microsoft/typescript-go/internal/transformers/declarations"
	"github.com/microsoft/typescript-go/internal/transformers/estransforms"
	"github.com/microsoft/typescript-go/internal/transformers/inliners"
	"github.com/microsoft/typescript-go/internal/transformers/jsxtransforms"
	"github.com/microsoft/typescript-go/internal/transformers/moduletransforms"
	"github.com/microsoft/typescript-go/internal/transformers/tstransforms"
	"github.com/microsoft/typescript-go/internal/tsoptions"
	"github.com/microsoft/typescript-go/internal/tspath"
)

type EmitContext = printer.EmitContext

type EmitSourceFileHook func(context *EmitContext, file *ast.SourceFile) *ast.SourceFile

type EmitHooks struct {
	BeforePrintDeclaration EmitSourceFileHook
	BeforePrintJS          EmitSourceFileHook
}

type hookEmitHost struct {
	program      *innercompiler.Program
	emitResolver printer.EmitResolver
}

type hookEmitter struct {
	host       *hookEmitHost
	emitOnly   innercompiler.EmitOnly
	emitResult innercompiler.EmitResult
	hooks      EmitHooks
	paths      *outputpaths.OutputPaths
	sourceFile *ast.SourceFile
	writeFile  innercompiler.WriteFile
	writer     printer.EmitTextWriter
}

func EmitWithHooks(ctx context.Context, program *innercompiler.Program, options innercompiler.EmitOptions, hooks EmitHooks) *innercompiler.EmitResult {
	if program == nil {
		return nil
	}
	if options.EmitOnly != innercompiler.EmitOnlyForcedDts {
		result := HandleNoEmitOnError(ctx, program, options.TargetSourceFile)
		if result != nil || ctx.Err() != nil {
			return result
		}
	}
	var results []*innercompiler.EmitResult
	newLine := program.Options().NewLine.GetNewLineCharacter()
	for _, sourceFile := range hookSourceFilesToEmit(program, options.TargetSourceFile, options.EmitOnly == innercompiler.EmitOnlyForcedDts) {
		host, done := newHookEmitHost(ctx, program, sourceFile)
		emitter := &hookEmitter{
			host:       host,
			emitOnly:   options.EmitOnly,
			hooks:      hooks,
			paths:      outputpaths.GetOutputPathsFor(sourceFile, host.Options(), host, options.EmitOnly == innercompiler.EmitOnlyForcedDts),
			sourceFile: sourceFile,
			writeFile:  options.WriteFile,
			writer:     printer.NewTextWriter(newLine, 0),
		}
		emitter.emit()
		done()
		results = append(results, &emitter.emitResult)
	}
	return CombineEmitResults(results)
}

func hookSourceFilesToEmit(program *innercompiler.Program, target *ast.SourceFile, forceDtsEmit bool) []*ast.SourceFile {
	if target != nil {
		if program.SourceFileMayBeEmitted(target, forceDtsEmit) {
			return []*ast.SourceFile{target}
		}
		return nil
	}
	var out []*ast.SourceFile
	for _, sourceFile := range program.SourceFiles() {
		if program.SourceFileMayBeEmitted(sourceFile, forceDtsEmit) {
			out = append(out, sourceFile)
		}
	}
	return out
}

func newHookEmitHost(ctx context.Context, program *innercompiler.Program, file *ast.SourceFile) (*hookEmitHost, func()) {
	checker, done := program.GetTypeCheckerForFile(ctx, file)
	return &hookEmitHost{
		program:      program,
		emitResolver: checker.GetEmitResolver(),
	}, done
}

func (e *hookEmitter) emit() {
	e.emitJSFile(e.sourceFile, e.paths.JsFilePath(), e.paths.SourceMapFilePath())
	e.emitDeclarationFile(e.sourceFile, e.paths.DeclarationFilePath(), e.paths.DeclarationMapPath())
	e.emitResult.Diagnostics = e.emitterDiagnostics()
}

func (e *hookEmitter) emitterDiagnostics() []*ast.Diagnostic {
	return e.emitResult.Diagnostics
}

func (e *hookEmitter) addDiagnostic(diag *ast.Diagnostic) {
	e.emitResult.Diagnostics = append(e.emitResult.Diagnostics, diag)
}

func (e *hookEmitter) runScriptTransformers(emitContext *printer.EmitContext, sourceFile *ast.SourceFile) *ast.SourceFile {
	for _, transformer := range hookScriptTransformers(emitContext, e.host, sourceFile) {
		sourceFile = transformer.TransformSourceFile(sourceFile)
	}
	return sourceFile
}

func (e *hookEmitter) runDeclarationTransformers(emitContext *printer.EmitContext, sourceFile *ast.SourceFile, declarationFilePath, declarationMapPath string) (*ast.SourceFile, []*ast.Diagnostic) {
	transform := declarations.NewDeclarationTransformer(e.host, emitContext, e.host.Options(), declarationFilePath, declarationMapPath)
	sourceFile = transform.TransformSourceFile(sourceFile)
	return sourceFile, transform.GetDiagnostics()
}

func (e *hookEmitter) emitJSFile(sourceFile *ast.SourceFile, jsFilePath string, sourceMapFilePath string) {
	options := e.host.Options()
	if sourceFile == nil || e.emitOnly != innercompiler.EmitAll && e.emitOnly != innercompiler.EmitOnlyJs || len(jsFilePath) == 0 {
		return
	}
	if options.NoEmit == core.TSTrue || e.host.IsEmitBlocked(jsFilePath) {
		e.emitResult.EmitSkipped = true
		return
	}
	emitContext, putEmitContext := printer.GetEmitContext()
	defer putEmitContext()
	sourceFile = e.runScriptTransformers(emitContext, sourceFile)
	if e.hooks.BeforePrintJS != nil {
		sourceFile = e.hooks.BeforePrintJS(emitContext, sourceFile)
	}
	printerOptions := printer.PrinterOptions{
		RemoveComments:  options.RemoveComments.IsTrue(),
		NewLine:         options.NewLine,
		NoEmitHelpers:   options.NoEmitHelpers.IsTrue(),
		SourceMap:       options.SourceMap.IsTrue(),
		InlineSourceMap: options.InlineSourceMap.IsTrue(),
		InlineSources:   options.InlineSources.IsTrue(),
		Target:          options.Target,
	}
	p := printer.NewPrinter(printerOptions, printer.PrintHandlers{}, emitContext)
	e.printSourceFile(jsFilePath, sourceMapFilePath, sourceFile, p, hookShouldEmitSourceMaps(options, sourceFile))
}

func (e *hookEmitter) emitDeclarationFile(sourceFile *ast.SourceFile, declarationFilePath string, declarationMapPath string) {
	options := e.host.Options()
	if sourceFile == nil || e.emitOnly == innercompiler.EmitOnlyJs || len(declarationFilePath) == 0 {
		return
	}
	if e.emitOnly != innercompiler.EmitOnlyForcedDts && (options.NoEmit == core.TSTrue || e.host.IsEmitBlocked(declarationFilePath)) {
		e.emitResult.EmitSkipped = true
		return
	}
	emitContext, putEmitContext := printer.GetEmitContext()
	defer putEmitContext()
	sourceFile, diags := e.runDeclarationTransformers(emitContext, sourceFile, declarationFilePath, declarationMapPath)
	if e.hooks.BeforePrintDeclaration != nil {
		sourceFile = e.hooks.BeforePrintDeclaration(emitContext, sourceFile)
	}
	printerOptions := printer.PrinterOptions{
		RemoveComments:      options.RemoveComments.IsTrue(),
		OnlyPrintJSDocStyle: true,
		NewLine:             options.NewLine,
		NoEmitHelpers:       options.NoEmitHelpers.IsTrue(),
		SourceMap:           options.DeclarationMap.IsTrue(),
		InlineSourceMap:     options.InlineSourceMap.IsTrue(),
		InlineSources:       options.InlineSources.IsTrue(),
	}
	p := printer.NewPrinter(printerOptions, printer.PrintHandlers{}, emitContext)
	for _, diag := range diags {
		e.addDiagnostic(diag)
	}
	e.printSourceFile(declarationFilePath, declarationMapPath, sourceFile, p, e.emitOnly != innercompiler.EmitOnlyForcedDts && hookShouldEmitDeclarationSourceMaps(options, sourceFile))
}

func (e *hookEmitter) printSourceFile(filePath string, sourceMapFilePath string, sourceFile *ast.SourceFile, printer_ *printer.Printer, shouldEmitSourceMaps bool) {
	options := e.host.Options()
	var sourceMapGenerator *sourcemap.Generator
	if shouldEmitSourceMaps {
		sourceMapGenerator = sourcemap.NewGenerator(
			tspath.GetBaseFileName(tspath.NormalizeSlashes(filePath)),
			hookSourceRoot(options),
			e.sourceMapDirectory(options, filePath, sourceFile),
			tspath.ComparePathsOptions{
				UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
				CurrentDirectory:          e.host.GetCurrentDirectory(),
			},
		)
	}
	printer_.Write(sourceFile.AsNode(), sourceFile, e.writer, sourceMapGenerator)
	sourceMapURLPos := -1
	if sourceMapGenerator != nil {
		if options.SourceMap.IsTrue() || options.InlineSourceMap.IsTrue() || options.GetAreDeclarationMapsEnabled() {
			e.emitResult.SourceMaps = append(e.emitResult.SourceMaps, &innercompiler.SourceMapEmitResult{
				InputSourceFileNames: sourceMapGenerator.Sources(),
				SourceMap:            sourceMapGenerator.RawSourceMap(),
				GeneratedFile:        filePath,
			})
		}
		sourceMappingURL := e.sourceMappingURL(options, sourceMapGenerator, filePath, sourceMapFilePath, sourceFile)
		if len(sourceMappingURL) > 0 {
			if !e.writer.IsAtStartOfLine() {
				e.writer.RawWrite(core.IfElse(options.NewLine == core.NewLineKindCRLF, "\r\n", "\n"))
			}
			sourceMapURLPos = e.writer.GetTextPos()
			e.writer.WriteComment("//# sourceMappingURL=")
			e.writer.WriteComment(sourceMappingURL)
		}
		if len(sourceMapFilePath) > 0 {
			sourceMap := sourceMapGenerator.String()
			if err := e.writeText(sourceMapFilePath, sourceMap, nil); err != nil {
				e.addDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Could_not_write_file_0_Colon_1, filePath, err.Error()))
			} else {
				e.emitResult.EmittedFiles = append(e.emitResult.EmittedFiles, sourceMapFilePath)
			}
		}
	} else {
		e.writer.WriteLine()
	}
	text := e.writer.String()
	if options.EmitBOM.IsTrue() {
		text = stringutil.AddUTF8ByteOrderMark(text)
	}
	data := &innercompiler.WriteFileData{
		SourceMapUrlPos: sourceMapURLPos,
		Diagnostics:     e.emitterDiagnostics(),
	}
	err := e.writeText(filePath, text, data)
	skippedDtsWrite := data.SkippedDtsWrite
	if err != nil {
		e.addDiagnostic(ast.NewCompilerDiagnostic(diagnostics.Could_not_write_file_0_Colon_1, filePath, err.Error()))
	} else if !skippedDtsWrite {
		e.emitResult.EmittedFiles = append(e.emitResult.EmittedFiles, filePath)
	}
	e.writer.Clear()
}

func (e *hookEmitter) writeText(fileName string, text string, data *innercompiler.WriteFileData) error {
	if e.writeFile != nil {
		return e.writeFile(fileName, text, data)
	}
	return e.host.WriteFile(fileName, text)
}

func (e *hookEmitter) sourceMapDirectory(options *core.CompilerOptions, filePath string, sourceFile *ast.SourceFile) string {
	if len(options.SourceRoot) > 0 {
		return e.host.CommonSourceDirectory()
	}
	if len(options.MapRoot) > 0 {
		sourceMapDir := tspath.NormalizeSlashes(options.MapRoot)
		if sourceFile != nil {
			sourceMapDir = tspath.GetDirectoryPath(outputpaths.GetSourceFilePathInNewDir(
				sourceFile.FileName(),
				sourceMapDir,
				e.host.GetCurrentDirectory(),
				e.host.CommonSourceDirectory(),
				e.host.UseCaseSensitiveFileNames(),
			))
		}
		if tspath.GetRootLength(sourceMapDir) == 0 {
			sourceMapDir = tspath.CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir)
		}
		return sourceMapDir
	}
	return tspath.GetDirectoryPath(tspath.NormalizePath(filePath))
}

func (e *hookEmitter) sourceMappingURL(options *core.CompilerOptions, sourceMapGenerator *sourcemap.Generator, filePath string, sourceMapFilePath string, sourceFile *ast.SourceFile) string {
	if options.InlineSourceMap.IsTrue() {
		return sourceMapGenerator.Base64DataURL()
	}
	sourceMapFile := tspath.GetBaseFileName(tspath.NormalizeSlashes(sourceMapFilePath))
	if len(options.MapRoot) > 0 {
		sourceMapDir := tspath.NormalizeSlashes(options.MapRoot)
		if sourceFile != nil {
			sourceMapDir = tspath.GetDirectoryPath(outputpaths.GetSourceFilePathInNewDir(
				sourceFile.FileName(),
				sourceMapDir,
				e.host.GetCurrentDirectory(),
				e.host.CommonSourceDirectory(),
				e.host.UseCaseSensitiveFileNames(),
			))
		}
		if tspath.GetRootLength(sourceMapDir) == 0 {
			sourceMapDir = tspath.CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir)
			return stringutil.EncodeURI(
				tspath.GetRelativePathToDirectoryOrUrl(
					tspath.GetDirectoryPath(tspath.NormalizePath(filePath)),
					tspath.CombinePaths(sourceMapDir, sourceMapFile),
					true,
					tspath.ComparePathsOptions{
						UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
						CurrentDirectory:          e.host.GetCurrentDirectory(),
					},
				),
			)
		}
		return stringutil.EncodeURI(tspath.CombinePaths(sourceMapDir, sourceMapFile))
	}
	return stringutil.EncodeURI(sourceMapFile)
}

func hookShouldEmitSourceMaps(options *core.CompilerOptions, sourceFile *ast.SourceFile) bool {
	return (options.SourceMap.IsTrue() || options.InlineSourceMap.IsTrue()) &&
		!tspath.FileExtensionIs(sourceFile.FileName(), tspath.ExtensionJson)
}

func hookShouldEmitDeclarationSourceMaps(options *core.CompilerOptions, sourceFile *ast.SourceFile) bool {
	return options.DeclarationMap.IsTrue() &&
		!tspath.FileExtensionIs(sourceFile.FileName(), tspath.ExtensionJson)
}

func hookSourceRoot(options *core.CompilerOptions) string {
	sourceRoot := tspath.NormalizeSlashes(options.SourceRoot)
	if len(sourceRoot) > 0 {
		sourceRoot = tspath.EnsureTrailingDirectorySeparator(sourceRoot)
	}
	return sourceRoot
}

func hookScriptTransformers(emitContext *printer.EmitContext, host printer.EmitHost, sourceFile *ast.SourceFile) []*transformers.Transformer {
	var tx []*transformers.Transformer
	options := host.Options()
	importElisionEnabled := !options.VerbatimModuleSyntax.IsTrue() && !ast.IsInJSFile(sourceFile.AsNode())
	jsxTransformEnabled := options.GetJSXTransformEnabled() && sourceFile.LanguageVariant == core.LanguageVariantJSX
	emitResolver := host.GetEmitResolver()
	var referenceResolver binder.ReferenceResolver
	if importElisionEnabled || jsxTransformEnabled || !options.GetIsolatedModules() || options.EmitDecoratorMetadata.IsTrue() {
		emitResolver.MarkLinkedReferencesRecursively(sourceFile)
		referenceResolver = emitResolver
	} else {
		referenceResolver = binder.NewReferenceResolver(options, binder.ReferenceResolverHooks{})
	}
	opts := transformers.TransformOptions{
		Context:                   emitContext,
		CompilerOptions:           options,
		Resolver:                  referenceResolver,
		EmitResolver:              emitResolver,
		GetEmitModuleFormatOfFile: host.GetEmitModuleFormatOfFile,
	}
	if options.EmitDecoratorMetadata.IsTrue() {
		tx = append(tx, tstransforms.NewMetadataTransformer(&opts))
	}
	tx = append(tx, tstransforms.NewTypeEraserTransformer(&opts))
	if importElisionEnabled {
		tx = append(tx, tstransforms.NewImportElisionTransformer(&opts))
	}
	tx = append(tx, tstransforms.NewRuntimeSyntaxTransformer(&opts))
	if options.ExperimentalDecorators.IsTrue() {
		tx = append(tx, tstransforms.NewLegacyDecoratorsTransformer(&opts))
	}
	if jsxTransformEnabled {
		tx = append(tx, jsxtransforms.NewJSXTransformer(&opts))
	}
	downleveler := estransforms.GetESTransformer(&opts)
	if downleveler != nil {
		tx = append(tx, downleveler)
	}
	tx = append(tx, estransforms.NewUseStrictTransformer(&opts))
	tx = append(tx, hookModuleTransformer(&opts))
	if !options.GetIsolatedModules() {
		tx = append(tx, inliners.NewConstEnumInliningTransformer(&opts))
	}
	return tx
}

func hookModuleTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
	switch opts.CompilerOptions.GetEmitModuleKind() {
	case core.ModuleKindPreserve:
		return moduletransforms.NewESModuleTransformer(opts)
	case core.ModuleKindESNext,
		core.ModuleKindES2022,
		core.ModuleKindES2020,
		core.ModuleKindES2015,
		core.ModuleKindNode20,
		core.ModuleKindNode18,
		core.ModuleKindNode16,
		core.ModuleKindNodeNext,
		core.ModuleKindCommonJS:
		return moduletransforms.NewImpliedModuleTransformer(opts)
	default:
		return moduletransforms.NewCommonJSModuleTransformer(opts)
	}
}

func (host *hookEmitHost) GetModeForUsageLocation(file ast.HasFileName, moduleSpecifier *ast.StringLiteralLike) core.ResolutionMode {
	return host.program.GetModeForUsageLocation(file, moduleSpecifier)
}

func (host *hookEmitHost) GetResolvedModuleFromModuleSpecifier(file ast.HasFileName, moduleSpecifier *ast.StringLiteralLike) *module.ResolvedModule {
	return host.program.GetResolvedModuleFromModuleSpecifier(file, moduleSpecifier)
}

func (host *hookEmitHost) GetDefaultResolutionModeForFile(file ast.HasFileName) core.ResolutionMode {
	return host.program.GetDefaultResolutionModeForFile(file)
}

func (host *hookEmitHost) GetEmitModuleFormatOfFile(file ast.HasFileName) core.ModuleKind {
	return host.program.GetEmitModuleFormatOfFile(file)
}

func (host *hookEmitHost) FileExists(path string) bool {
	return host.program.FileExists(path)
}

func (host *hookEmitHost) GetGlobalTypingsCacheLocation() string {
	return host.program.GetGlobalTypingsCacheLocation()
}

func (host *hookEmitHost) GetNearestAncestorDirectoryWithPackageJson(dirname string) string {
	return host.program.GetNearestAncestorDirectoryWithPackageJson(dirname)
}

func (host *hookEmitHost) GetPackageJsonInfo(pkgJSONPath string) *packagejson.InfoCacheEntry {
	return host.program.GetPackageJsonInfo(pkgJSONPath)
}

func (host *hookEmitHost) GetSourceOfProjectReferenceIfOutputIncluded(file ast.HasFileName) string {
	return host.program.GetSourceOfProjectReferenceIfOutputIncluded(file)
}

func (host *hookEmitHost) GetProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
	return host.program.GetProjectReferenceFromSource(path)
}

func (host *hookEmitHost) GetRedirectTargets(path tspath.Path) []string {
	return host.program.GetRedirectTargets(path)
}

func (host *hookEmitHost) GetEffectiveDeclarationFlags(node *ast.Node, flags ast.ModifierFlags) ast.ModifierFlags {
	return host.GetEmitResolver().GetEffectiveDeclarationFlags(node, flags)
}

func (host *hookEmitHost) GetOutputPathsFor(file *ast.SourceFile, forceDtsPaths bool) declarations.OutputPaths {
	return outputpaths.GetOutputPathsFor(file, host.Options(), host, forceDtsPaths)
}

func (host *hookEmitHost) GetResolutionModeOverride(node *ast.Node) core.ResolutionMode {
	return host.GetEmitResolver().GetResolutionModeOverride(node)
}

func (host *hookEmitHost) GetSourceFileFromReference(origin *ast.SourceFile, ref *ast.FileReference) *ast.SourceFile {
	return host.program.GetSourceFileFromReference(origin, ref)
}

func (host *hookEmitHost) Options() *core.CompilerOptions { return host.program.Options() }
func (host *hookEmitHost) SourceFiles() []*ast.SourceFile { return host.program.SourceFiles() }
func (host *hookEmitHost) GetCurrentDirectory() string    { return host.program.GetCurrentDirectory() }
func (host *hookEmitHost) CommonSourceDirectory() string  { return host.program.CommonSourceDirectory() }
func (host *hookEmitHost) UseCaseSensitiveFileNames() bool {
	return host.program.UseCaseSensitiveFileNames()
}

func (host *hookEmitHost) IsEmitBlocked(file string) bool {
	return host.program.IsEmitBlocked(file)
}

func (host *hookEmitHost) WriteFile(fileName string, text string) error {
	return host.program.Host().FS().WriteFile(fileName, text)
}

func (host *hookEmitHost) GetEmitResolver() printer.EmitResolver {
	return host.emitResolver
}

func (host *hookEmitHost) IsSourceFileFromExternalLibrary(file *ast.SourceFile) bool {
	return host.program.IsSourceFileFromExternalLibrary(file)
}

func (host *hookEmitHost) GetSymlinkCache() *symlinks.KnownSymlinks {
	return host.program.GetSymlinkCache()
}

func (host *hookEmitHost) ResolveModuleName(moduleName string, containingFile string, resolutionMode core.ResolutionMode) *module.ResolvedModule {
	return host.program.ResolveModuleName(moduleName, containingFile, resolutionMode)
}
