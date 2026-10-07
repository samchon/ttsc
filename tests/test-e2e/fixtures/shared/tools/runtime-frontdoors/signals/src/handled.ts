declare const process: { env: Record<string, string | undefined>; on(event: string, listener: (signal: string) => void): void; exit(code: number): never };
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, (received) => { console.log("handled " + received); process.exit(3); });
}
console.log("ready:" + process.env.TTSC_TEST_READY_TOKEN);
setInterval(() => {}, 1000);
export {};
