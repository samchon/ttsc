export interface ITtscBuildResult {
  emittedFiles?: string[];
  status: number;
  stdout: string;
  stderr: string;
}
