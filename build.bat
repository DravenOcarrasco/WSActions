@echo off

rem Delete the 'build' directory if it exists
if exist build (
    rd /s /q build
)

rem Delete the 'src-build' directory if it exists
if exist src-build (
    rd /s /q src-build
)

rem Transpile TypeScript to JavaScript
call tsc

rem Build the Bun project
call bun build .\src-build\src\index.js --target=bun --compile --outfile build\server

rem Copy the 'public' directory to 'build'
xcopy /E /I public build\public

rem Copy the 'extensions' directory to 'build'
xcopy /E /I extensions build\extensions

rem Copy the 'scripts' directory to 'build'
xcopy /E /I scripts build\scripts

rem Delete the 'build/index.ts' file if it exists
set build_dir=%cd%\build
if exist "%build_dir%\extensions\index.ts" (
    del /f /q "%build_dir%\extensions\index.ts"
)

rem Delete the 'src-build' directory if it exists (final step)
if exist src-build (
    rd /s /q src-build
)

echo Build process completed.