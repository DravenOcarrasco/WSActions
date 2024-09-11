# Limpa a pasta 'build' se ela existir no início
if (Test-Path build) {
    Remove-Item -Recurse -Force build
    Write-Host "'build' directory has been removed."
}

# Remove a pasta 'src-build' se ela existir
if (Test-Path src-build) {
    Remove-Item -Recurse -Force src-build
    Write-Host "'src-build' directory has been removed."
}

# Transpile TypeScript para JavaScript (se necessário)
tsc

# Executa o comando nexe-build
npm run nexe-build

# Cria a pasta 'build' antes de mover o WSActions.exe, caso ainda não exista
if (!(Test-Path build)) {
    New-Item -ItemType Directory -Path build
}

# Move WSActions.exe para a pasta 'build'
if (Test-Path WSActions.exe) {
    Move-Item -Path WSActions.exe -Destination build\
    Write-Host "WSActions.exe moved to 'build' directory."
}

# Move WSActions.exe para a pasta 'build'
if (Test-Path UnsecureChromium.bat) {
    Copy-Item -Path UnsecureChromium.bat -Destination build\
    Write-Host "UnsecureChromium.bat Copied to 'build' directory."
}

# Copia a pasta 'public' para 'build\public'
Copy-Item -Recurse -Path public -Destination build\public
Write-Host "'public' directory copied to 'build\public'."

# Copia a pasta 'extensions' para 'build\extensions'
Copy-Item -Recurse -Path extensions -Destination build\extensions
Write-Host "'extensions' directory copied to 'build\extensions'."

# Copia a pasta 'scripts' para 'build\scripts'
Copy-Item -Recurse -Path scripts -Destination build\scripts
Write-Host "'scripts' directory copied to 'build\scripts'."

# Copia a pasta 'ChromeExtension' para 'build\ChromeExtension'
Copy-Item -Recurse -Path ChromeExtension -Destination build\ChromeExtension
Write-Host "'ChromeExtension' directory copied to 'build\ChromeExtension'."

# Copia a pasta 'node_modules' para 'build\node_modules'
# Copy-Item -Recurse -Path node_modules -Destination build\node_modules
# Write-Host "'node_modules' directory copied to 'build\node_modules'."

# Define o diretório de build
$build_dir = Join-Path (Get-Location) 'build'

# Deleta o arquivo 'extensions/index.ts' se ele existir
$index_ts = Join-Path $build_dir 'extensions\index.ts'
if (Test-Path $index_ts) {
    Remove-Item -Force $index_ts
    Write-Host "'extensions/index.ts' file has been deleted."
}

# Remove a pasta 'src-build' se ela existir (etapa final)
if (Test-Path src-build) {
    Remove-Item -Recurse -Force src-build
    Write-Host "'src-build' directory has been removed (final step)."
}

Write-Host "Build process completed."
Pause
