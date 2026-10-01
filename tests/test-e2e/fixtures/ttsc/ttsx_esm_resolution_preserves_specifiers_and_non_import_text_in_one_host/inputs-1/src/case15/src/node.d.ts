declare module "node:fs" { export function readFileSync(file: string | URL, encoding: string): string; }
declare module "node:path" { export function dirname(file: string): string; export function resolve(...parts: string[]): string; }
declare module "node:url" { export function fileURLToPath(url: string): string; }
