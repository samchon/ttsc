// @ttsc-corpus-clean: promise/no-new-statics
Promise.resolve(1); new Promise(resolve => resolve(1));
