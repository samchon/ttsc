declare module "node:fs" {
  export function readFileSync(path: string): string;
  export function writeFileSync(path: string, data: string): void;
}

declare module "node:path" {
  export function resolve(...segments: string[]): string;
}
