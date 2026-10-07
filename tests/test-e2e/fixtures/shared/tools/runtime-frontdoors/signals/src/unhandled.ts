declare const process: { env: Record<string, string | undefined> };
console.log("ready:" + process.env.TTSC_TEST_READY_TOKEN);
setInterval(() => {}, 1000);
export {};
