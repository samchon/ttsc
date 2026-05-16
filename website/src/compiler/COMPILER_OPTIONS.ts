import ts from "typescript";

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  experimentalDecorators: true,
};
