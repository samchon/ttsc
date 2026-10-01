// @ttsc-corpus-clean: promise/always-return
Promise.resolve(1).then(() => { return 1; }); Promise.resolve(1).then(() => { throw new Error(); });
