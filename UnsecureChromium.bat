@echo off
echo Selecione qual navegador deseja abrir:
echo 1. Chrome
echo 2. Chromium
set /p navegador="Digite o número correspondente (1 ou 2): "

REM Define os caminhos de instalação
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROMIUM_PATH=%HOMEDRIVE%%HOMEPATH%\AppData\Local\Chromium\Application\chrome.exe

REM Define caminhos diferentes para user-data-dir de cada navegador
set CHROME_USER_DATA_DIR=%HOMEDRIVE%%HOMEPATH%\AppData\Local\Google\Chrome\User Data
set CHROMIUM_USER_DATA_DIR=%HOMEDRIVE%%HOMEPATH%\AppData\Local\Chromium\User Data

REM Verifica a escolha do usuário e inicia o navegador correspondente
if "%navegador%"=="1" (
    if exist "%CHROME_PATH%" (
        echo Iniciando o Chrome com todas as restrições desativadas...
        "%CHROME_PATH%" --disable-web-security --disable-site-isolation-trials --user-data-dir="%CHROME_USER_DATA_DIR%" --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure --allow-running-insecure-content --ignore-certificate-errors --disable-popup-blocking --enable-cookies --disable-blink-features=BlockCredentialedSubresources --flag-switches-begin --flag-switches-end
    ) else (
        echo Chrome não encontrado no caminho especificado: %CHROME_PATH%
        pause
    )
) else if "%navegador%"=="2" (
    if exist "%CHROMIUM_PATH%" (
        echo Iniciando o Chromium com todas as restrições desativadas...
        "%CHROMIUM_PATH%" --disable-web-security --disable-site-isolation-trials --user-data-dir="%CHROMIUM_USER_DATA_DIR%" --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure --allow-running-insecure-content --ignore-certificate-errors --disable-popup-blocking --enable-cookies --disable-blink-features=BlockCredentialedSubresources --flag-switches-begin --flag-switches-end
    ) else (
        echo Chromium não encontrado no caminho especificado: %CHROMIUM_PATH%
        pause
    )
) else (
    echo Opção inválida. Execute o script novamente e escolha 1 ou 2.
    pause
)
