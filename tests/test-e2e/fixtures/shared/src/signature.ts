export function oneLiner(n: number): number { return n * 2; }
export function withTypeLiteral(options: {
  host: string;
  port: number;
}): Promise<void> {
  return Promise.resolve();
}
