# Limpa a pasta de build se existir
if (Test-Path build) {
    Remove-Item -Recurse -Force build
    Write-Host "'build' directory has been removed."
}

# Remove a pasta 'src-build' se ela existir
if (Test-Path src-build) {
    Remove-Item -Recurse -Force src-build
    Write-Host "'src-build' directory has been removed."
}

# Transpile TypeScript para JavaScript
tsc

# Executa o comando nexe-build
npm run nexe-build

# Cria a pasta de build
if (!(Test-Path build)) {
    New-Item -ItemType Directory -Path build
}

# Verifica se o WSActions.exe existe antes de mover
if (Test-Path WSActions.exe) {
    Copy-Item -Path WSActions.exe -Destination build
    Write-Host "WSActions.exe moved to 'build' directory."
} else {
    Write-Host "WSActions.exe not found. Ensure it is generated during the build process."
}

# Copia arquivos necessários para a pasta de build
$filesToCopy = @('UnsecureChromium.bat', 'public', 'extensions', 'scripts', 'ChromeExtension')
foreach ($file in $filesToCopy) {
    Copy-Item -Recurse -Path $file -Destination build\$file
    Write-Host "'$file' copied to 'build' directory."
}

# Copia node_modules e package.json para a pasta build
Copy-Item -Recurse -Path node_modules -Destination build\node_modules
Write-Host "'node_modules' copied to 'build'."

Copy-Item -Path package.json -Destination build\package.json
Write-Host "'package.json' copied to 'build'."

# Remove o arquivo 'extensions/index.ts' se ele existir
$index_ts = Join-Path (Get-Location) 'build\extensions\index.ts'
if (Test-Path $index_ts) {
    Remove-Item -Force $index_ts
    Write-Host "'extensions/index.ts' file has been deleted from 'build'."
}

# Zipa a pasta de build com -Force
$zipPath = Join-Path (Get-Location) 'WSAction_build.zip'

Compress-Archive -Path build\* -DestinationPath $zipPath -Force

# Remove o WSActions.exe da raiz após o processo
if (Test-Path WSActions.exe) {
    Remove-Item -Path WSActions.exe -Force
    Write-Host "WSActions.exe removed from the root directory."
}

Write-Host "Build process completed and zipped as 'WSAction_build.zip'."