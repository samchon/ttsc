@echo off
set "GOFLAGS=-tags=ttsc_main"
"%TTSC_PROBE_REAL_GO%" %*
exit /b %errorlevel%
