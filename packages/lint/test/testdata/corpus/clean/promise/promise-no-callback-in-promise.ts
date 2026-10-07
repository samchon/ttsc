// @ttsc-corpus-clean: promise/no-callback-in-promise
cb(); Promise.resolve(1).then(() => { work(); });
