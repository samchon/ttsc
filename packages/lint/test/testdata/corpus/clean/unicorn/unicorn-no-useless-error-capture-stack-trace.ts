// @ttsc-corpus-clean: unicorn/no-useless-error-capture-stack-trace
class MyError extends Error { constructor(msg: string) { super(msg); } }
