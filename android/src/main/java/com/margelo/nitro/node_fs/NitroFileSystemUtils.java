package com.margelo.nitro.node_fs;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.util.Log;

import java.io.FileNotFoundException;

public class NitroFileSystemUtils {
    private static Context context;
    private static final String TAG = "NitroFileSystemUtils";

    public static void initialize(Context ctx) {
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
}
