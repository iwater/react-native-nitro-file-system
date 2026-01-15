#include "RNNodeFileSystemOnLoad.hpp"
#include <jni.h>

static JavaVM *g_vm = nullptr;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  g_vm = vm;
  return margelo::nitro::node_fs::initialize(vm);
}

namespace margelo::nitro::node_fs {
JNIEnv *getJNIEnv() {
  JNIEnv *env = nullptr;
  if (g_vm == nullptr)
    return nullptr;

  int ret = g_vm->GetEnv((void **)&env, JNI_VERSION_1_6);
  if (ret == JNI_EDETACHED) {
    if (g_vm->AttachCurrentThread(&env, nullptr) != 0) {
      return nullptr;
    }
  } else if (ret != JNI_OK) {
    return nullptr;
  }
  return env;
}
} // namespace margelo::nitro::node_fs
