// @ttsc-corpus-clean: no-setter-return
class Holder { set value(input: string) { if (!input) return; log(input); } }
