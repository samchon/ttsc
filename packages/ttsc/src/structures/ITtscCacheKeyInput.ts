export interface ITtscCacheKeyInput {
  file: string;
  tsconfig: string;
  version: string;
  mode?: string;
  extra?: readonly string[];
}
