package com.margelo.nitro.node_fs;

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;
import android.util.Log;

public class NitroFileSystemPackage implements ReactPackage {
    static {
        try {
            System.loadLibrary("RNNodeFileSystem");
        } catch (Throwable e) {
            Log.e("NitroFileSystemPackage", "Failed to load RNNodeFileSystem library", e);
        }
    }

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        NitroFileSystemUtils.initialize(reactContext);
        return Collections.emptyList();
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
