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

# Cria a pasta de build se não existir
if (!(Test-Path build)) {
    New-Item -ItemType Directory -Path build
}

# Transpila o TypeScript usando SWC e o arquivo .swcrc
Write-Host "Transpiling TypeScript to JavaScript using SWC..."
npx swc .\ --out-dir build --config-file .swcrc
Write-Host "Transpilation completed using SWC."

# Compila com o Bun e gera um executável
Write-Host "Compiling with Bun to generate an executable..."
bun build .\build\src\index.js --outfile .\build\WSActions --compile
Write-Host "Executable created with Bun."

# Verifica se o WSActions.exe (ou apenas WSActions) existe antes de mover
if (Test-Path .\build\WSActions) {
    Write-Host "WSActions.exe successfully created in the 'build' directory."
} else {
    Write-Host "WSActions.exe not found. Ensure Bun was able to generate the executable."
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

# COMENTADO: Zipa a pasta de build com -Force (descomente se necessário)
$zipPath = Join-Path (Get-Location) 'WSAction_build.zip'
Compress-Archive -Path build\* -DestinationPath $zipPath -Force
Write-Host "Build process completed and zipped as 'WSAction_build.zip'."

# Remove o WSActions.exe da raiz após o processo (se existir algum na raiz)
if (Test-Path WSActions.exe) {
    Remove-Item -Path WSActions.exe -Force
    Write-Host "WSActions.exe removed from the root directory."
}

Write-Host "Build process completed successfully."
