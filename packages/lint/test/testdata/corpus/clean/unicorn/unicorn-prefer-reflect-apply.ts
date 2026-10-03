// @ttsc-corpus-clean: unicorn/prefer-reflect-apply
function f(a:number,b:number) { return a+b; } const r = Reflect.apply(f,null,[1,2]);
