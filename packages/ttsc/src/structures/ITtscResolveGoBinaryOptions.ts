export interface ITtscResolveGoBinaryOptions {
  arch?: string;
  env?: NodeJS.ProcessEnv;
  localGoLookup?: () => string | null;
  platform?: NodeJS.Platform;
  resolver?: (request: string) => string;
}
