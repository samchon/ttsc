import type { ITransformOptions } from "./ITransformOptions";

/**
 * Worker ↔ UI RPC contract for the playground compiler service.
 *
 * `createWorkerCompiler` (worker side) implements this. `createCompilerClient`
 * (UI side) returns a tgrid Driver bound to this shape. Sites that need an
 * `extraTabs` lane should layer additional verbs over this base interface in
 * their own ICompilerService subtype.
 */
export interface ICompilerService {
  /**
   * Mount external npm package files into the worker's MemFS under
   * `node_modules/`. Driven by the dependency installer in
   * `@ttsc/playground/npm`.
   */
  installDependencies(
    props: ICompilerService.IInstallDependenciesProps,
  ): Promise<ICompilerService.IInstallDependenciesResult>;

  /**
   * Compile the user's source into JavaScript with diagnostics. Plugin
   * transforms (typia, when enabled in options) run first; the result is the
   * post-transform emit.
   */
  compile(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;

  /**
   * Same pipeline as `compile`, but using the bundle-flavored tsconfig
   * (typically `module: "CommonJS"` for in-page `new Function` sandboxing).
   * Sites that don't run user code may treat this identically to `compile`.
   */
  bundle(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;

  /**
   * Run the lint plugin and parse its findings into the same diagnostic shape
   * as `compile`. Returns an empty list when no lint plugin is wired into the
   * worker.
   */
  lint(props: ICompilerService.IProps): Promise<ICompilerService.ILintResult>;
}

export namespace ICompilerService {
  export interface IProps {
    source: string;
    options?: ITransformOptions;
  }

  export interface IInstallDependenciesProps {
    /** Node_modules-relative paths to text content. */
    files: Record<string, string>;
    /** Metadata for the packages whose files are in `files`. */
    packages: IInstalledPackage[];
  }

  export interface IInstalledPackage {
    name: string;
    version: string;
  }

  export interface IInstallDependenciesResult {
    installed: IInstalledPackage[];
    fileCount: number;
  }

  export type IResult = ISuccess | IFailure | IError;

  export interface ISuccess extends IBase<"success", string> {}
  export interface IFailure extends IBase<"failure", string> {
    diagnostics: IDiagnostic[];
  }
  export interface IError extends IBase<"error", unknown> {}

  interface IBase<Type extends string, Value> {
    type: Type;
    target: "javascript";
    value: Value;
  }

  export interface IDiagnostic {
    /** 1-based line number. */
    line: number;
    /** 1-based column number. */
    column: number;
    /** Length of the span in source characters; at least 1. */
    length: number;
    severity: "error" | "warning";
    message: string;
    /** Diagnostic code, e.g. `"TS2322"` or a lint rule id. */
    code?: string;
  }

  export interface ILintResult {
    diagnostics: IDiagnostic[];
  }
}
