// @ttsc-corpus-clean: unicorn/no-accessor-recursion
class C { private backing = 1; get value() { return this.backing; } }
