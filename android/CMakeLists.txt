cmake_minimum_required(VERSION 3.9.0)
project(RNNodeFileSystem)

set(PACKAGE_NAME RNNodeFileSystem)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Add our custom implementation and JNI adapter
add_library(${PACKAGE_NAME} SHARED
        ../cpp/HybridFileSystem.cpp
        ../cpp/HybridDirIterator.cpp
        ../cpp/HybridFileWatcher.cpp
        OnLoad.cpp
)

# Include paths for our headers
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/../cpp
)

# Include the Nitrogen-generated CMake file
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/RNNodeFileSystem+autolinking.cmake)

# Link the Rust FileSystem library
target_link_directories(${PACKAGE_NAME} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/libs/${ANDROID_ABI})
target_link_libraries(${PACKAGE_NAME} 
    rn_file_system
    log
)
