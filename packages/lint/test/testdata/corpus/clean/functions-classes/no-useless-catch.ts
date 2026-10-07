// @ttsc-corpus-clean: no-useless-catch
try { work(); } catch (e) { log(e); throw e; }
