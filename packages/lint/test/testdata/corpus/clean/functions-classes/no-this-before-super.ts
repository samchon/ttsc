// @ttsc-corpus-clean: no-this-before-super
class Base { value = 0; } class Child extends Base { constructor() { super(); this.value = 1; } }
