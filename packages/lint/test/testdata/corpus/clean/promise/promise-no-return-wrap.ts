// @ttsc-corpus-clean: promise/no-return-wrap
Promise.resolve(1).then(() => { return 2; }); Promise.resolve(1).then(() => 2);
