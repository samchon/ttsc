@echo off
set "GOFLAGS="
"%TTSC_PROBE_REAL_GO%" %*
exit /b %errorlevel%
