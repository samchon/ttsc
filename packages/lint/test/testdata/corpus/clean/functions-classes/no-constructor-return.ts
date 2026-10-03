// @ttsc-corpus-clean: no-constructor-return
class Foo { constructor() { const nested = () => 1; if (nested()) return; } }
