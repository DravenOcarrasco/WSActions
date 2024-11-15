#!/bin/bash

# Function to extract version from about.ts
get_version() {
    version=$(grep 'VERSION:' ./src/about.ts | grep -o '".*"' | sed 's/"//g')
    if [ -z "$version" ]; then
        echo "unknown-version"
    else
        echo "$version"
    fi
}

# Clean up existing directories
if [ -d "build" ]; then
    rm -rf build
    echo "'build' directory has been removed."
fi

if [ -d "src-build" ]; then
    rm -rf src-build
    echo "'src-build' directory has been removed."
fi

# Create build directory
mkdir -p build
echo "'build' directory has been created."

# Get version
version=$(get_version)
echo "Version detected: $version"

# Transpile TypeScript using tsc
echo "Transpiling TypeScript to JavaScript using tsc..."
npx tsc
if [ $? -ne 0 ]; then
    echo "Transpilation failed."
    exit 1
fi
echo "Transpilation completed using tsc."

# Compile project using pkg for Windows and Linux
echo "Compiling the project with pkg for Windows and Linux..."

targets=("node18-win-x64" "node16-linux-x64")
executables=()

for target in "${targets[@]}"; do
    case "$target" in
        "node18-win-x64")
            ext=".exe"
            ;;
        "node16-linux-x64")
            ext=""
            ;;
        *)
            ext=""
            ;;
    esac
    
    output_name="WSAction-$version-$target$ext"
    executables+=("$output_name")
    
    pkg package.json --targets "$target" --output "build/$output_name"
    if [ $? -ne 0 ]; then
        echo "pkg compilation failed for target $target."
        exit 1
    fi
    echo "Executable for $target created: build/$output_name"
done

# Verify executables were created
all_exist=true
for exe in "${executables[@]}"; do
    if [ ! -f "build/$exe" ]; then
        echo "$exe not found. Ensure pkg was able to generate the executable."
        all_exist=false
    else
        echo "$exe successfully created in the 'build' directory."
    fi
done

if [ "$all_exist" = false ]; then
    exit 1
fi

# Copy necessary files to build directory
files_to_copy=("UnsecureChromium.bat" "public" "extensions" "scripts" "ChromeExtension")
for file in "${files_to_copy[@]}"; do
    if [ -e "$file" ]; then
        cp -r "$file" "build/$file"
        echo "'$file' copied to 'build' directory."
    else
        echo "Warning: '$file' does not exist and was not copied."
    fi
done

# Copy package.json to build directory
cp package.json build/package.json
echo "'package.json' copied to 'build'."

# Remove extensions/index.ts if it exists
if [ -f "build/extensions/index.ts" ]; then
    rm "build/extensions/index.ts"
    echo "'extensions/index.ts' file has been deleted from 'build'."
fi

# Create zip archive
zip_name="WSAction_build_$version.zip"
if [ -d "build" ]; then
    echo "Zipping the build directory..."
    cd build && zip -r "../$zip_name" * && cd ..
    echo "Build process completed and zipped as '$zip_name'."
else
    echo "Build directory not found, skipping zipping process."
fi

# Remove executables from root if they exist
for exe in "${executables[@]}"; do
    if [ -f "$exe" ]; then
        rm "$exe"
        echo "$exe removed from the root directory."
    fi
done

echo "Build process completed successfully."
