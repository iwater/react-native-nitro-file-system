#!/bin/bash
# build_all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Building React Native Rust File System..."

# Add local bin to PATH for cargo-ndk/cargo-lipo if needed
export PATH=$PATH:$HOME/.cargo/bin

# 解析命令行参数
AUTO_CONFIRM=false
while getopts "y" opt; do
  case $opt in
    y)
      AUTO_CONFIRM=true
      echo "🤖 Auto-confirm enabled (-y)"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

# 清理
echo "🧹 Cleaning previous builds..."
cargo clean

# 1. 生成绑定并构建库
echo "🔧 Building Rust library..."
# Just build purely to make sure it compiles and generates headers
cargo build --release

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Rust library"
    exit 1
fi

echo "✅ Rust library built successfully"

# 3. 构建 iOS 库
if [ "$AUTO_CONFIRM" = true ]; then
    REPLY="y"
else
    read -p "Do you want to build iOS libraries? (y/n): " -n 1 -r
    echo
fi
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📱 Building iOS libraries..."
    mkdir -p target/xcframework
    
    # 构建各个架构
    IOS_TARGETS=("x86_64-apple-ios" "aarch64-apple-ios-sim" "aarch64-apple-ios")
    
    for target in "${IOS_TARGETS[@]}"; do
        echo "  Building for $target..."
        cargo build --target "$target" --release
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to build for $target"
            exit 1
        fi
    done
    
    # ===== 动态库构建 (Dynamic Framework) =====
    
    # 创建模拟器通用动态库
    echo "  Creating universal simulator dynamic library..."
    mkdir -p target/universal/ios-sim
    xcrun lipo -create \
        target/x86_64-apple-ios/release/librn_file_system.dylib \
        target/aarch64-apple-ios-sim/release/librn_file_system.dylib \
        -output target/universal/ios-sim/librn_file_system.dylib
    
    # 创建设备动态库目录
    echo "  Preparing device dynamic library..."
    mkdir -p target/universal/ios-device
    cp target/aarch64-apple-ios/release/librn_file_system.dylib \
       target/universal/ios-device/librn_file_system.dylib
       
    # 设置正确的 install_name
    echo "  Setting install names..."
    install_name_tool -id @rpath/RustFileSystem.framework/RustFileSystem \
        target/universal/ios-sim/librn_file_system.dylib
    install_name_tool -id @rpath/RustFileSystem.framework/RustFileSystem \
        target/universal/ios-device/librn_file_system.dylib
        
    # 创建 Framework 结构
    echo "  Creating Framework structure..."
    FRAMEWORK_SIM="target/universal/ios-sim/RustFileSystem.framework"
    FRAMEWORK_DEVICE="target/universal/ios-device/RustFileSystem.framework"
    
    # 清理旧的 Framework
    rm -rf "$FRAMEWORK_SIM" "$FRAMEWORK_DEVICE"
    
    # 创建模拟器 Framework
    mkdir -p "$FRAMEWORK_SIM/Headers"
    cp target/universal/ios-sim/librn_file_system.dylib "$FRAMEWORK_SIM/RustFileSystem"
    cp include/*.h "$FRAMEWORK_SIM/Headers/" 2>/dev/null || echo "Info: No headers found in include/"
    
    # 创建设备 Framework
    mkdir -p "$FRAMEWORK_DEVICE/Headers"
    cp target/universal/ios-device/librn_file_system.dylib "$FRAMEWORK_DEVICE/RustFileSystem"
    cp include/*.h "$FRAMEWORK_DEVICE/Headers/" 2>/dev/null || echo "Info: No headers found in include/"
    
    # 创建 Info.plist for Frameworks
    cat > "$FRAMEWORK_SIM/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>RustFileSystem</string>
    <key>CFBundleIdentifier</key>
    <string>com.iwater.RustFileSystem</string>
    <key>CFBundleName</key>
    <string>RustFileSystem</string>
    <key>CFBundlePackageType</key>
    <string>FMWK</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>MinimumOSVersion</key>
    <string>13.0</string>
</dict>
</plist>
PLIST
    cp "$FRAMEWORK_SIM/Info.plist" "$FRAMEWORK_DEVICE/Info.plist"
    
    # 生成 XCFramework
    echo "  Creating XCFramework..."
    rm -rf target/xcframework/RustFileSystem.xcframework
    
    xcodebuild -create-xcframework \
        -framework "$FRAMEWORK_SIM" \
        -framework "$FRAMEWORK_DEVICE" \
        -output target/xcframework/RustFileSystem.xcframework
    
    if [ $? -eq 0 ]; then
        echo "✅ iOS XCFramework built successfully!"
        echo "  XCFramework: target/xcframework/RustFileSystem.xcframework"
    else
        echo "❌ Failed to create XCFramework"
        exit 1
    fi
fi

# 4. 构建 Android 库
if [ "$AUTO_CONFIRM" = true ]; then
    REPLY="y"
else
    read -p "Do you want to build Android libraries? (y/n): " -n 1 -r
    echo
fi
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🤖 Building Android libraries..."
    
    # 检查并设置 NDK
    if [ -z "$ANDROID_NDK_HOME" ]; then
        ANDROID_NDK_HOME="$HOME/Library/Android/sdk/ndk/27.1.12297006"
        if [ ! -d "$ANDROID_NDK_HOME" ]; then
            echo "❌ Android NDK not found at $ANDROID_NDK_HOME"
            echo "Please set ANDROID_NDK_HOME environment variable"
            exit 1
        fi
    fi
    
    echo "  Using NDK at: $ANDROID_NDK_HOME"
    
    # Android 目标架构
    ANDROID_TARGETS=(
        "aarch64-linux-android"
        "armv7-linux-androideabi" 
        "i686-linux-android"
        "x86_64-linux-android"
    )
    
    for target in "${ANDROID_TARGETS[@]}"; do
        echo "  Building for $target..."
        RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384" cargo ndk --target "$target" --platform 21 build --release
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to build for $target"
            exit 1
        fi
    done
    
    # 整理输出
    mkdir -p target/universal/android/{arm64-v8a,armeabi-v7a,x86,x86_64}
    
    cp target/aarch64-linux-android/release/librn_file_system.so \
       target/universal/android/arm64-v8a/
    cp target/armv7-linux-androideabi/release/librn_file_system.so \
       target/universal/android/armeabi-v7a/
    cp target/i686-linux-android/release/librn_file_system.so \
       target/universal/android/x86/
    cp target/x86_64-linux-android/release/librn_file_system.so \
       target/universal/android/x86_64/
    
    echo "✅ Android libraries built successfully!"
fi

echo "🧪 Running Rust tests..."
cargo test -- --test-threads=1 --nocapture

echo ""
echo "🎉 Build completed successfully!"
