// @ttsc-corpus-clean: promise/no-promise-in-callback
function done(err: Error | null) { if (err) throw err; return Promise.resolve(1); }
