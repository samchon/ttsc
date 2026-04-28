// expect: no-promise-executor-return error
new Promise((resolve) => resolve(1));
