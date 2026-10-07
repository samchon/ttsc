// @ttsc-corpus-clean: promise/no-return-in-finally
Promise.resolve(1).finally(() => { console.log("cleanup"); });
