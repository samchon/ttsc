// @ttsc-corpus-clean: no-unsafe-finally
function f() { try { throw new Error("x"); } finally { log("cleanup"); } }
