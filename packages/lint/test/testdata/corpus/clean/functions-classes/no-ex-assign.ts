// @ttsc-corpus-clean: no-ex-assign
try { work(); } catch (e) { let local = e; local = "handled"; log(e, local); }
