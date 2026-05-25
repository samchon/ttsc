// expect: noAsyncPromiseExecutor error
new Promise(async (resolve) => {
  resolve(1);
});
