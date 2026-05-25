import type { ITransformOptions } from "./ITransformOptions";

export interface ICompilerService {
  installDependencies(
    props: ICompilerService.IInstallDependenciesProps,
  ): Promise<ICompilerService.IInstallDependenciesResult>;
  compile(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;
  bundle(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;
  lint(props: ICompilerService.IProps): Promise<ICompilerService.ILintResult>;
}

export namespace ICompilerService {
  export interface IProps {
    source: string;
    options?: ITransformOptions;
  }

  export interface IInstallDependenciesProps {
    files: Record<string, string>;
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
    line: number;
    column: number;
    length: number;
    severity: "error" | "warning";
    message: string;
    code?: string;
  }

  export interface ILintResult {
    diagnostics: IDiagnostic[];
  }
}
