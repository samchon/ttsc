declare module "node:fs" { export function writeFileSync(file: string, text: string): void; }
declare const process: { env: { TTSX_MARKER: string } };
