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
if ($LASTEXITCODE -ne 0) {
    Write-Host "Transpilation failed."
    exit 1
}
Write-Host "Transpilation completed using tsc."
# Compila o projeto usando o pkg para Windows e Linux
Write-Host "Compiling the project with pkg for Windows and Linux..."

# Definir os targets desejados
$targets = @("node18-win-x64", "node16-linux-x64")

foreach ($target in $targets) {
    # Define a extensão do executável com base no target
    switch ($target) {
        "node18-win-x64" { $ext = ".exe" }
        "node16-linux-x64" { $ext = "" }
        default { $ext = "" }
    }
    $outputName = "WSAction-$version-$target$ext"
    pkg package.json --targets $target --output "build\$outputName"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "pkg compilation failed for target $target."
        exit 1
    }
    Write-Host "Executable for $target created: build\$outputName"
}

# Verifica se os executáveis foram criados
$executables = @("WSAction-$version-node18-win-x64.exe", "WSAction-$version-node16-linux-x64")
$allExist = $true
foreach ($exe in $executables) {
    if (!(Test-Path ".\build\$exe")) {
        Write-Host "$exe not found. Ensure pkg was able to generate the executable."
        $allExist = $false
    } else {
        Write-Host "$exe successfully created in the 'build' directory."
    }
}
if (-not $allExist) {
    exit 1
}

# Copia arquivos necessários para a pasta de build
$filesToCopy = @('UnsecureChromium.bat', 'public', 'extensions', 'scripts', 'ChromeExtension')
foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item -Recurse -Path $file -Destination build\$file
        Write-Host "'$file' copied to 'build' directory."
    } else {
        Write-Host "Warning: '$file' does not exist and was not copied."
    }
}

# Copia package.json para a pasta build
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

# Remove os executáveis da raiz após o processo (se existirem na raiz)
foreach ($exe in $executables) {
    if (Test-Path $exe) {
        Remove-Item -Path $exe -Force
        Write-Host "$exe removed from the root directory."
    }
}

Write-Host "Build process completed successfully."