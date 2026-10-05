declare const console: { log(...values: unknown[]): void; error(value: unknown): void };
declare const process: { exitCode: number | undefined };
export {};
async function main(): Promise<void> {
  const dependency = await import("batch-configured-diagnostic");
  console.log("dependency entry ran", dependency.hello());
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
