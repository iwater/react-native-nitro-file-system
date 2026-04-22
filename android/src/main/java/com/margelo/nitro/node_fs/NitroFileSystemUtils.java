package com.margelo.nitro.node_fs;

import android.content.ContentResolver;
import android.content.Context;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Log;
import android.webkit.MimeTypeMap;

import com.facebook.react.bridge.ReactApplicationContext;

import java.io.File;
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
        nSetAssetManager(ctx.getAssets());
    }

    private static ContentResolver getContentResolver() {
        if (context == null) {
            Log.e(TAG, "Context is null. Make sure initialization is called.");
            return null;
        }
        return context.getContentResolver();
    }

    /**
     * Prepares a URI for content resolver operations.
     * Handles "path-augmented" tree URIs by converting them to valid document URIs within the tree.
     * e.g., content://auth/tree/rootId/sub/path -> content://auth/tree/rootId/document/rootId%2Fsub%2Fpath
     */
    private static Uri prepareUri(String uriString) {
        try {
            Uri uri = Uri.parse(uriString);
            if (uri.getScheme() == null || !uri.getScheme().equals("content")) {
                return uri;
            }

            List<String> segments = uri.getPathSegments();
            // Check if it's a tree-based URI
            // Standard tree URI: content://{auth}/tree/{treeId} (2 segments)
            // Augmented tree URI: content://{auth}/tree/{treeId}/sub/path (> 2 segments)
            if (segments.size() >= 2 && "tree".equals(segments.get(0))) {
                // Check if it's already a document URI (contains "document" segment)
                boolean isDocument = false;
                for (String segment : segments) {
                    if ("document".equals(segment)) {
                        isDocument = true;
                        break;
                    }
                }

                if (!isDocument) {
                    String authority = uri.getAuthority();
                    String treeId = segments.get(1);

                    // Reconstruct the document ID by joining all segments after "tree"
                    StringBuilder docIdBuilder = new StringBuilder();
                    for (int i = 1; i < segments.size(); i++) {
                        if (docIdBuilder.length() > 0) {
                            docIdBuilder.append("/");
                        }
                        docIdBuilder.append(segments.get(i));
                    }
                    String documentId = docIdBuilder.toString();

                    // Build the proper document URI within the tree
                    Uri treeUri = DocumentsContract.buildTreeDocumentUri(authority, treeId);
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId);
                }
            }
            return uri;
        } catch (Exception e) {
            return Uri.parse(uriString);
        }
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

            Uri uri = prepareUri(uriString);
            ParcelFileDescriptor pfd = null;
            
            try {
                pfd = resolver.openFileDescriptor(uri, mode);
            } catch (Exception e) {
                // ExternalStorageProvider throws IllegalArgumentException (Failed to determine if child) 
                // for non-existent files in Tree URIs, instead of FileNotFoundException.
                boolean isWriting = mode.contains("w") || mode.contains("a") || mode.contains("+");
                if (isWriting && uriString.contains("/tree/")) {
                    try {
                        Uri createdUri = createDocument(uriString);
                        if (createdUri != null) {
                            pfd = resolver.openFileDescriptor(createdUri, mode);
                        } else {
                            throw e;
                        }
                    } catch (Exception createEx) {
                        Log.e(TAG, "Failed to create document: " + uriString, createEx);
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
            
            if (pfd != null) {
                // detachFd() closes the ParcelFileDescriptor object but returns the 
                // native fd without closing it, transferring ownership to the caller.
                return pfd.detachFd();
            }
        } catch (FileNotFoundException e) {
            Log.e(TAG, "File not found: " + uriString + " (mode: " + mode + ")");
        } catch (Exception e) {
            Log.e(TAG, "Error opening content URI: " + uriString + " (mode: " + mode + ")", e);
        }
        return -1;
    }

    /**
     * Creates a document in the parent directory specified by the URI string.
     */
    private static Uri createDocument(String uriString) throws Exception {
        int lastSlash = uriString.lastIndexOf('/');
        if (lastSlash == -1) return null;

        String parentUriString = uriString.substring(0, lastSlash);
        String fileName = uriString.substring(lastSlash + 1);

        Uri parentUri = prepareUri(parentUriString);
        ContentResolver resolver = getContentResolver();
        if (resolver == null) return null;

        String mimeType = "application/octet-stream";
        int dot = fileName.lastIndexOf('.');
        if (dot != -1) {
            String ext = fileName.substring(dot + 1).toLowerCase();
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            if (mime != null) mimeType = mime;
        }

        return DocumentsContract.createDocument(resolver, parentUri, mimeType, fileName);
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

            Uri uri = prepareUri(uriString);
            Cursor cursor = resolver.query(uri, null, null, null, null);
            
            double size = 0;
            double lastModified = 0;

            if (cursor != null && cursor.moveToFirst()) {
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
                    size = cursor.getDouble(sizeIndex);
                }
                
                // Try to get last modified if available (not standard in OpenableColumns but common)
                int modIndex = cursor.getColumnIndex("last_modified");
                if (modIndex != -1 && !cursor.isNull(modIndex)) {
                    lastModified = cursor.getDouble(modIndex);
                }
                
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
            Uri uri = prepareUri(uriString);
            // Try to open a read-only FD to check existence
            // Faster than querying provider for simple check
            ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(uri, "r");
            if (pfd != null) {
                pfd.close();
                return true;
            }
        } catch (Exception e) {
            // ignore
        }
        return false;
    }

    // Delete a content URI
    public static boolean deleteContentUri(String uriString) {
        if (context == null) return false;
        try {
            Uri uri = prepareUri(uriString);
            // 1. Try DocumentsContract if it's a document URI
            if (DocumentsContract.isDocumentUri(context, uri)) {
                return DocumentsContract.deleteDocument(context.getContentResolver(), uri);
            }
            // 2. Fallback to standard ContentResolver deletion
            int deletedEntries = context.getContentResolver().delete(uri, null, null);
            return deletedEntries > 0;
        } catch (Exception e) {
            // ignore
        }
        return false;
    }

    /**
     * Efficiently copy data between URIs (content:// or file://)
     */
    public static boolean copyContentUri(String sourceUriString, String destUriString) {
        if (context == null) return false;
        try {
            Uri srcUri = prepareUri(sourceUriString);
            // Convert plain paths to file:// URIs if scheme is missing
            if (srcUri.getScheme() == null) {
                srcUri = Uri.fromFile(new java.io.File(sourceUriString));
            }
            
            Uri destUri = prepareUri(destUriString);
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
            Uri uri = prepareUri(uriString);
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

    public static String getDirectoryPath(String type) {
        if (context == null) return "";
        File dir = null;
        switch (type) {
            case "caches":
                dir = context.getCacheDir();
                break;
            case "documents":
                dir = context.getFilesDir();
                break;
            case "downloads":
                dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                break;
            case "externalCaches":
                dir = context.getExternalCacheDir();
                break;
            case "externalDocuments":
                dir = context.getExternalFilesDir(null);
                break;
            case "externalStorage":
                dir = Environment.getExternalStorageDirectory();
                break;
            case "pictures":
                dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                break;
            case "temp":
                dir = context.getCacheDir();
                break;
            case "mainBundle":
                return context.getPackageResourcePath();
        }
        return dir != null ? dir.getAbsolutePath() : "";
    }

    private static native void nSetAssetManager(AssetManager assetManager);
}
