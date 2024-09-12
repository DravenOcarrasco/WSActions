@echo off
REM Define o caminho para o Chrome
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

REM Define o caminho correto para o user-data-dir
set CHROME_USER_DATA_DIR=%HOMEDRIVE%%HOMEPATH%\AppData\Local\Google\Chrome\User Data

REM Verifica se o Chrome está no caminho especificado
if exist "%CHROME_PATH%" (
    echo Iniciando o Chrome com todas as restrições desativadas...
    "%CHROME_PATH%" --disable-web-security --disable-site-isolation-trials --user-data-dir="%CHROME_USER_DATA_DIR%" --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure --allow-running-insecure-content --ignore-certificate-errors --disable-popup-blocking --enable-cookies --disable-blink-features=BlockCredentialedSubresources --flag-switches-begin --flag-switches-end
) else (
    echo Chrome não encontrado no caminho especificado: %CHROME_PATH%
    pause
)
