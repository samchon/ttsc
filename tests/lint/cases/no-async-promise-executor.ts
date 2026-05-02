// expect: no-async-promise-executor error
new Promise(async (resolve) => { resolve(1); });
