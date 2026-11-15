package com.draftalore.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class DraftALoreInstrumentedTest {
    @Test
    public void installedApplicationHasTheExpectedIdentityAndLabel() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().equals("com.draftalore.app") || context.getPackageName().equals("com.draftalore.app.debug"));
        String expectedLabel = context.getPackageName().endsWith(".debug") ? "Draft A Lore (Test)" : "Draft A Lore";
        assertEquals(expectedLabel, context.getApplicationInfo().loadLabel(context.getPackageManager()).toString());
    }
    @Test
    public void nativeFileValidationRejectsUnsafePathsAndNames() {
        assertTrue(FolderSyncPlugin.isSafePath("Chapters/scene.txt"));
        assertTrue(!FolderSyncPlugin.isSafePath("../scene.txt"));
        assertTrue(!FolderSyncPlugin.isSafePath("Chapters\\scene.txt"));
        assertTrue(FileExportPlugin.isSafeFilename("Chapter 1.epub"));
        assertTrue(!FileExportPlugin.isSafeFilename("bad\nname.epub"));
        assertTrue(!FileExportPlugin.isSafeFilename("folder/file.epub"));
    }
    @Test
    public void cameraProviderAllowsAppPicturesButNotExternalRoot() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        java.io.File pictures = context.getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES);
        org.junit.Assert.assertNotNull(pictures);
        String authority = context.getPackageName() + ".fileprovider";
        android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(context, authority, new java.io.File(pictures, "draftalore-camera-test.jpg"));
        assertEquals("content", uri.getScheme());
        org.junit.Assert.assertThrows(IllegalArgumentException.class, () -> androidx.core.content.FileProvider.getUriForFile(context, authority, new java.io.File(android.os.Environment.getExternalStorageDirectory(), "draftalore-unrelated-test.jpg")));
    }
}
