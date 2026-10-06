const log = [];
async function run() {
  log.push("before");
  await 0;
  log.push("after");
}
void run();
log.push("sync");
void Promise.resolve().then(() => console.log(log.join(",")));
