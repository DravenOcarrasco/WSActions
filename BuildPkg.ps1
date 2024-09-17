# Função para extrair a versão do arquivo about.ts
function Get-Version {
    $aboutFile = Get-Content -Path .\src\about.ts
    foreach ($line in $aboutFile) {
        if ($line -match 'VERSION: "(.+)"') {
            return $matches[1]
        }
    }
    return "unknown-version"
}

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
    Write-Host "'build' directory has been created."
}

# Extrai a versão do arquivo about.ts
$version = Get-Version
Write-Host "Version detected: $version"

# Transpila o TypeScript usando tsc
Write-Host "Transpiling TypeScript to JavaScript using tsc..."
npx tsc
Write-Host "Transpilation completed using tsc."

# Compila o projeto usando o pkg e inclui a versão no nome do arquivo de saída
Write-Host "Compiling the project with pkg..."
pkg package.json --output build/WSAction-$version
Write-Host "Executable created with pkg."

# Verifica se o WSActions-$version.exe (ou apenas WSActions-$version) existe antes de mover
if (Test-Path ".\build\WSAction-$version.exe") {
    Write-Host "WSActions-$version.exe successfully created in the 'build' directory."
} else {
    Write-Host "WSActions-$version.exe not found. Ensure pkg was able to generate the executable."
    exit 1
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

# Zipa a pasta de build com a versão no nome do arquivo zip
$zipPath = Join-Path (Get-Location) "WSAction_build_$version.zip"
if (Test-Path build) {
    Write-Host "Zipping the build directory..."
    Compress-Archive -Path build\* -DestinationPath $zipPath -Force
    Write-Host "Build process completed and zipped as 'WSAction_build_$version.zip'."
} else {
    Write-Host "Build directory not found, skipping zipping process."
}

# Remove o WSActions.exe da raiz após o processo (se existir algum na raiz)
if (Test-Path WSActions.exe) {
    Remove-Item -Path WSActions.exe -Force
    Write-Host "WSActions.exe removed from the root directory."
}

Write-Host "Build process completed successfully."
