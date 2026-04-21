package com.margelo.nitro.node_fs;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.util.Log;

import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.List;

import android.app.Activity;
import android.content.Intent;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.BaseActivityEventListener;
import android.webkit.MimeTypeMap;

public class NitroFileSystemUtils {
    private static Context context;
    private static ReactApplicationContext reactContext;
    private static final String TAG = "NitroFileSystemUtils";

    public static void initialize(ReactApplicationContext ctx) {
        reactContext = ctx;
        context = ctx.getApplicationContext();
    }

    private static ContentResolver getContentResolver() {
        if (context == null) {
            Log.e(TAG, "Context is null. Make sure initialization is called.");
            return null;
        }
        return context.getContentResolver();
    }

    /**
     * Opens a file descriptor for the given Content URI.
     * Called from C++ via JNI.
     *
     * @param uriString The content:// URI string
     * @param mode      The mode string (e.g., "r", "w", "rw")
     * @return The native file descriptor (int) or -1 if failed.
     */
    public static int openContentUri(String uriString, String mode) {
        try {
            ContentResolver resolver = getContentResolver();
            if (resolver == null) return -1;

            Uri uri = Uri.parse(uriString);
            ParcelFileDescriptor pfd = resolver.openFileDescriptor(uri, mode);
            
            if (pfd != null) {
                // detatchFd() closes the ParcelFileDescriptor object but returns the 
                // native fd without closing it, transferring ownership to the caller.
                return pfd.detachFd();
            }
        } catch (FileNotFoundException e) {
            Log.e(TAG, "File not found: " + uriString, e);
        } catch (Exception e) {
            Log.e(TAG, "Error opening content URI: " + uriString, e);
        }
        return -1;
    }

    /**
     * Gets file stats (size, name) for a Content URI.
     * Called from C++ via JNI to simulate fstat/stat.
     * 
     * @param uriString The content:// URI string
     * @return An array of doubles: [size, lastModified] (can be expanded) or null if failed
     */
    public static double[] getStatContentUri(String uriString) {
        try {
            ContentResolver resolver = getContentResolver();
            if (resolver == null) return null;

            Uri uri = Uri.parse(uriString);
            Cursor cursor = resolver.query(uri, null, null, null, null);
            
            double size = 0;
            double lastModified = 0;

            if (cursor != null && cursor.moveToFirst()) {
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (!cursor.isNull(sizeIndex)) {
                    size = cursor.getDouble(sizeIndex);
                }
                
                // ContentResolver doesn't standardized lastModified in standard columns usually,
                // but we can try to look for it or default to current time/0.
                // For now, we mainly need size for read buffers.
                cursor.close();
            }
            
            return new double[]{size, lastModified};
        } catch (Exception e) {
            Log.e(TAG, "Error stating content URI: " + uriString, e);
        }
        return null;
    }
    // Check if a content URI exists and is accessible
    public static boolean existsContentUri(String uriString) {
        if (context == null) return false;
        try {
            Uri uri = Uri.parse(uriString);
            // Try to open a read-only FD to check existence
            // Faster than querying provider for simple check
            ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(uri, "r");
            if (pfd != null) {
                pfd.close();
                return true;
            }
        } catch (Exception e) {
            // Log.e("NitroFS", "existsContentUri failed", e);
        }
        return false;
    }

    // Delete a content URI
    public static boolean deleteContentUri(String uriString) {
        if (context == null) return false;
        try {
            Uri uri = Uri.parse(uriString);
            // 1. Try DocumentsContract if it's a document URI
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT 
                && android.provider.DocumentsContract.isDocumentUri(context, uri)) {
                return android.provider.DocumentsContract.deleteDocument(context.getContentResolver(), uri);
            }
            // 2. Fallback to standard ContentResolver deletion
            int deletedEntries = context.getContentResolver().delete(uri, null, null);
            return deletedEntries > 0;
        } catch (Exception e) {
            // Log.e("NitroFS", "deleteContentUri failed", e);
        }
        return false;
    }

    /**
     * Efficiently copy data between URIs (content:// or file://)
     */
    public static boolean copyContentUri(String sourceUriString, String destUriString) {
        if (context == null) return false;
        try {
            Uri srcUri = Uri.parse(sourceUriString);
            // Convert plain paths to file:// URIs if scheme is missing
            if (srcUri.getScheme() == null) {
                srcUri = Uri.fromFile(new java.io.File(sourceUriString));
            }
            
            Uri destUri = Uri.parse(destUriString);
            if (destUri.getScheme() == null) {
                destUri = Uri.fromFile(new java.io.File(destUriString));
            }

            ContentResolver resolver = context.getContentResolver();
            try (java.io.InputStream in = resolver.openInputStream(srcUri);
                 java.io.OutputStream out = resolver.openOutputStream(destUri)) {
                
                if (in == null || out == null) return false;
                
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    android.os.FileUtils.copy(in, out);
                } else {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                }
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "copyContentUri failed: from " + sourceUriString + " to " + destUriString, e);
        }
        return false;
    }
    public static native void nativeOnFilesPicked(long promisePtr, PickerResult[] files);
    public static native void nativeOnFilesPickError(long promisePtr, String error);
    public static native void nativeOnDirPicked(long promisePtr, PickedDirectory directory);
    public static native void nativeOnDirPickError(long promisePtr, String error);

    public static class PickerResult {
        public String path;
        public String uri;
        public String name;
        public double size;
        public String type;
        public String bookmark;
    }

    public static class PickedDirectory {
        public String path;
        public String uri;
        public String bookmark;
    }

    private static final int PICK_FILES_REQUEST_CODE = 4001;
    private static final int PICK_DIR_REQUEST_CODE = 4002;

    private static long pendingFilesPromisePtr = 0;
    private static String pendingFilesMode = "open";
    private static boolean pendingFilesLongTerm = false;
    private static long pendingDirPromisePtr = 0;

    private static final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == PICK_FILES_REQUEST_CODE) {
                long promisePtr = pendingFilesPromisePtr;
                String mode = pendingFilesMode;
                boolean longTerm = pendingFilesLongTerm;
                
                pendingFilesPromisePtr = 0;
                reactContext.removeActivityEventListener(this);

                if (resultCode != Activity.RESULT_OK || data == null) {
                    if (promisePtr != 0) nativeOnFilesPickError(promisePtr, "User cancelled");
                    return;
                }

                if (promisePtr != 0) {
                    List<PickerResult> results = new ArrayList<>();
                    if (data.getClipData() != null) {
                        for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                            Uri uri = data.getClipData().getItemAt(i).getUri();
                            results.add(processPickedFile(uri, mode, longTerm));
                        }
                    } else if (data.getData() != null) {
                        results.add(processPickedFile(data.getData(), mode, longTerm));
                    }

                    nativeOnFilesPicked(promisePtr, results.toArray(new PickerResult[0]));
                }
            } else if (requestCode == PICK_DIR_REQUEST_CODE) {
                long promisePtr = pendingDirPromisePtr;
                pendingDirPromisePtr = 0;
                reactContext.removeActivityEventListener(this);

                if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
                    if (promisePtr != 0) nativeOnDirPickError(promisePtr, "User cancelled");
                    return;
                }

                Uri uri = data.getData();
                final int takeFlags = data.getFlags()
                        & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                
                try {
                    reactContext.getContentResolver().takePersistableUriPermission(uri, takeFlags);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to take persistable URI permission for " + uri.toString(), e);
                }

                if (promisePtr != 0) {
                    PickedDirectory pickedDir = new PickedDirectory();
                    pickedDir.path = uri.toString();
                    pickedDir.uri = uri.toString();
                    pickedDir.bookmark = uri.toString();
                    nativeOnDirPicked(promisePtr, pickedDir);
                }
            }
        }
    };

    private static PickerResult processPickedFile(Uri uri, String mode, boolean longTerm) {
        if ("import".equals(mode)) {
            // Import mode: Copy to cache
            PickerResult res = parseUri(uri);
            try {
                String fileName = res.name;
                if (fileName == null || fileName.isEmpty()) {
                    fileName = "imported_file_" + System.currentTimeMillis();
                }
                java.io.File cacheDir = context.getCacheDir();
                java.io.File destFile = new java.io.File(cacheDir, fileName);
                
                // Ensure unique filename if exists
                int count = 0;
                while (destFile.exists()) {
                    count++;
                    destFile = new java.io.File(cacheDir, count + "_" + fileName);
                }
                
                if (copyContentUri(uri.toString(), destFile.getAbsolutePath())) {
                    res.path = destFile.getAbsolutePath();
                    res.uri = Uri.fromFile(destFile).toString();
                    res.bookmark = ""; // No bookmark needed for local file
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to import file: " + uri.toString(), e);
            }
            return res;
        } else {
            // Open mode: Use original URI
            if (longTerm) {
                try {
                    final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                    reactContext.getContentResolver().takePersistableUriPermission(uri, takeFlags);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to take persistable permission for file: " + uri.toString());
                }
            }
            return parseUri(uri);
        }
    }

    public static String[] listContentUri(String uriString) {
        try {
            Uri uri = Uri.parse(uriString);
            Uri childrenUri;
            
            if (DocumentsContract.isTreeUri(uri)) {
                childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(uri, 
                    DocumentsContract.getTreeDocumentId(uri));
            } else if (DocumentsContract.isDocumentUri(reactContext, uri)) {
                childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(uri, 
                    DocumentsContract.getDocumentId(uri));
            } else {
                return null;
            }

            Cursor cursor = reactContext.getContentResolver().query(childrenUri, 
                    new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, 
                    null, null, null);
            
            if (cursor == null) return null;
            
            List<String> results = new ArrayList<>();
            while (cursor.moveToNext()) {
                results.add(cursor.getString(0));
            }
            cursor.close();
            return results.toArray(new String[0]);
        } catch (Exception e) {
            Log.e(TAG, "listContentUri failed: " + uriString, e);
            return null;
        }
    }


    private static PickerResult parseUri(Uri uri) {
        PickerResult res = new PickerResult();
        res.path = uri.toString();
        res.uri = uri.toString();
        res.name = "";
        res.size = 0.0;
        res.type = "";
        res.bookmark = uri.toString();

        if (context != null) {
            res.type = context.getContentResolver().getType(uri);
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);

                    if (!cursor.isNull(nameIndex)) {
                        res.name = cursor.getString(nameIndex);
                    }
                    if (!cursor.isNull(sizeIndex)) {
                        res.size = cursor.getDouble(sizeIndex);
                    }
                }
            } catch (Exception e) {
                // ignore
            }
        }
        return res;
    }

    public static void pickFiles(boolean multiple, String[] extensions, boolean requestLongTermAccess, String mode, long promisePtr) {
        if (reactContext == null) {
            nativeOnFilesPickError(promisePtr, "React Context not initialized");
            return;
        }

        Activity activity = reactContext.getCurrentActivity();
        if (activity == null) {
            nativeOnFilesPickError(promisePtr, "Current activity is null");
            return;
        }

        // Use ACTION_OPEN_DOCUMENT for both to ensure we get a URI we can copy if needed.
        // ACTION_GET_CONTENT is older and sometimes less reliable for stream copying.
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        
        if ("open".equals(mode)) {
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        }
        
        // Handle MimeTypes from extensions mapping
        String primaryMimeType = "*/*";
        if (extensions != null && extensions.length > 0) {
            List<String> mimeTypes = new ArrayList<>();
            for (String ext : extensions) {
                String e = ext.startsWith(".") ? ext.substring(1) : ext;
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(e.toLowerCase());
                if (mime != null) {
                    mimeTypes.add(mime);
                }
            }
            if (mimeTypes.size() == 1) {
                primaryMimeType = mimeTypes.get(0);
            } else if (mimeTypes.size() > 1) {
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
            }
        }
        
        intent.setType(primaryMimeType);

        if (multiple) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        pendingFilesPromisePtr = promisePtr;
        pendingFilesMode = mode;
        pendingFilesLongTerm = requestLongTermAccess;
        
        reactContext.addActivityEventListener(mActivityEventListener);
        
        try {
            activity.startActivityForResult(intent, PICK_FILES_REQUEST_CODE);
        } catch (Exception e) {
            pendingFilesPromisePtr = 0;
            reactContext.removeActivityEventListener(mActivityEventListener);
            nativeOnFilesPickError(promisePtr, e.getMessage());
        }
    }

    public static void pickDirectory(boolean requestLongTermAccess, long promisePtr) {
        if (reactContext == null) {
            nativeOnDirPickError(promisePtr, "React Context not initialized");
            return;
        }

        Activity activity = reactContext.getCurrentActivity();
        if (activity == null) {
            nativeOnDirPickError(promisePtr, "Current activity is null");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        pendingDirPromisePtr = promisePtr;
        reactContext.addActivityEventListener(mActivityEventListener);
        
        try {
            activity.startActivityForResult(intent, PICK_DIR_REQUEST_CODE);
        } catch (Exception e) {
            pendingDirPromisePtr = 0;
            reactContext.removeActivityEventListener(mActivityEventListener);
            nativeOnDirPickError(promisePtr, e.getMessage());
        }
    }
}
