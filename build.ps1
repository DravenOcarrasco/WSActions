# Limpa as pastas de build se existirem
if (Test-Path build) {
    Remove-Item -Recurse -Force build
    Write-Host "'build' directory has been removed."
}
if (Test-Path build-with-node-modules) {
    Remove-Item -Recurse -Force build-with-node-modules
    Write-Host "'build-with-node-modules' directory has been removed."
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

# Cria as pastas de build
if (!(Test-Path build)) {
    New-Item -ItemType Directory -Path build
}
if (!(Test-Path build-with-node-modules)) {
    New-Item -ItemType Directory -Path build-with-node-modules
}

# Verifica se o WSActions.exe existe antes de mover
if (Test-Path WSActions.exe) {
    Copy-Item -Path WSActions.exe -Destination build
    Copy-Item -Path WSActions.exe -Destination build-with-node-modules
    Write-Host "WSActions.exe moved to both 'build' directories."
} else {
    Write-Host "WSActions.exe not found. Ensure it is generated during the build process."
}

# Copia arquivos necessários para ambas as pastas
$filesToCopy = @('UnsecureChromium.bat', 'public', 'extensions', 'scripts', 'ChromeExtension')
foreach ($file in $filesToCopy) {
    Copy-Item -Recurse -Path $file -Destination build\$file
    Copy-Item -Recurse -Path $file -Destination build-with-node-modules\$file
    Write-Host "'$file' copied to both 'build' directories."
}

# Copia node_modules apenas para a pasta build-with-node-modules
Copy-Item -Recurse -Path node_modules -Destination build-with-node-modules\node_modules
Write-Host "'node_modules' copied to 'build-with-node-modules'."

# Remove o arquivo 'extensions/index.ts' se ele existir
$index_ts = Join-Path (Get-Location) 'build\extensions\index.ts'
if (Test-Path $index_ts) {
    Remove-Item -Force $index_ts
    Write-Host "'extensions/index.ts' file has been deleted from 'build'."
}
$index_ts_with_modules = Join-Path (Get-Location) 'build-with-node-modules\extensions\index.ts'
if (Test-Path $index_ts_with_modules) {
    Remove-Item -Force $index_ts_with_modules
    Write-Host "'extensions/index.ts' file has been deleted from 'build-with-node-modules'."
}

# Zipa ambas as pastas de build com -Force
$zipPath = Join-Path (Get-Location) 'WSAction_build.zip'
$zipPathWithModules = Join-Path (Get-Location) 'WSAction_build_with_node_modules.zip'

Compress-Archive -Path build\* -DestinationPath $zipPath -Force
Compress-Archive -Path build-with-node-modules\* -DestinationPath $zipPathWithModules -Force

# Remove o WSActions.exe da raiz após o processo
if (Test-Path WSActions.exe) {
    Remove-Item -Path WSActions.exe -Force
    Write-Host "WSActions.exe removed from the root directory."
}

Write-Host "Build process completed and zipped as 'WSAction_build.zip' and 'WSAction_build_with_node_modules.zip'."