export interface ITtscProjectPluginConfig {
  enabled?: boolean;
  transform?: string;
  [key: string]: unknown;
}
