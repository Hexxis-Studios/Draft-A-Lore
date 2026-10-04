package com.draftalore.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {
    private static final long MAX_BYTES = 256L * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private File staged;
    private String token;
    private String filename;
    private String mime;
    private long expected;
    private long written;
    private boolean awaitingPicker;
    private volatile boolean destroyed;
    private PluginCall pendingPicker;
    private Runnable expiry;

    @PluginMethod
    public void begin(PluginCall call) {
        io.execute(() -> {
            if (destroyed || staged != null) { call.reject("Another file export is active. Finish or cancel it first."); return; }
            Integer size = call.getInt("size");
            String name = call.getString("filename", "");
            String type = call.getString("mime", "application/octet-stream");
            if (size == null || size < 0 || size > MAX_BYTES || name.isEmpty() || name.length() > 200 || name.matches(".*[\\\\/\\p{Cntrl}].*")) {
                call.reject("Choose a valid filename and an export no larger than 256 MB."); return;
            }
            if (!type.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+")) type = "application/octet-stream";
            try {
                staged = File.createTempFile("draftalore-export-", ".tmp", getContext().getCacheDir());
                token = UUID.randomUUID().toString(); filename = name; mime = type; expected = size; written = 0;
                refreshExpiry();
                JSObject response = new JSObject(); response.put("token", token); call.resolve(response);
            } catch (Exception error) { clear(); call.reject("Could not prepare temporary export storage.", error); }
        });
    }

    @PluginMethod
    public void append(PluginCall call) {
        io.execute(() -> {
            if (!valid(call) || awaitingPicker) { call.reject("That export is no longer accepting data."); return; }
            String encoded = call.getString("data", ""); Integer offset = call.getInt("offset");
            if (offset == null || offset != written || encoded.length() > 349528 || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) {
                clear(); call.reject("Export data arrived out of order or was invalid."); return;
            }
            try {
                byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
                if (bytes.length == 0 || bytes.length > 256 * 1024 || written + bytes.length > expected) throw new IllegalArgumentException("Invalid chunk size");
                try (FileOutputStream output = new FileOutputStream(staged, true)) { output.write(bytes); }
                written += bytes.length;
                refreshExpiry();
                JSObject response = new JSObject(); response.put("written", written); call.resolve(response);
            } catch (Exception error) { clear(); call.reject("Could not stage the export. Your project is unchanged.", error); }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        io.execute(() -> {
            if (!valid(call) || awaitingPicker || written != expected || staged.length() != expected) { call.reject("The export is incomplete or another save picker is open."); return; }
            awaitingPicker = true; pendingPicker = call;
            if (expiry != null) handler.removeCallbacks(expiry);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType(mime); intent.putExtra(Intent.EXTRA_TITLE, filename);
            getActivity().runOnUiThread(() -> {
                if (destroyed) { call.reject("The app closed before opening the save picker."); return; }
                if (getActivity().isFinishing()) { io.execute(() -> { clear(); call.reject("The app closed before opening the save picker."); }); return; }
                try { startActivityForResult(call, intent, "fileChosen"); }
                catch (Exception error) { if (destroyed) call.reject("Export interrupted when the app closed."); else io.execute(() -> { clear(); call.reject("Android could not open a Save File picker.", error); }); }
            });
        });
    }

    @ActivityCallback
    private void fileChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (destroyed) { call.reject("Export interrupted when the app closed."); return; }
        io.execute(() -> {
            if (!valid(call) || !awaitingPicker) { call.reject("That export has expired. Start it again."); return; }
            if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
                clear(); JSObject response = new JSObject(); response.put("cancelled", true); call.resolve(response); return;
            }
            Uri uri = result.getData().getData();
            try (FileInputStream input = new FileInputStream(staged); OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException("The selected location cannot be written");
                byte[] buffer = new byte[64 * 1024]; long copied = 0; int count;
                while ((count = input.read(buffer)) != -1) { if (destroyed) throw new IllegalStateException("Export interrupted"); output.write(buffer, 0, count); copied += count; }
                output.flush(); if (copied != expected) throw new IllegalStateException("The complete file was not written");
            } catch (Exception error) { clear(); call.reject("Could not finish writing the file. Remove any partial file and retry; your project is unchanged.", error); return; }
            clear(); JSObject response = new JSObject(); response.put("saved", true); call.resolve(response);
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        io.execute(() -> { if (valid(call) && !awaitingPicker) clear(); call.resolve(); });
    }

    private boolean valid(PluginCall call) { return !destroyed && staged != null && token != null && token.equals(call.getString("token", "")); }
    private void refreshExpiry() {
        if (expiry != null) handler.removeCallbacks(expiry);
        String activeToken = token;
        expiry = () -> { if (!destroyed) io.execute(() -> { if (!awaitingPicker && activeToken.equals(token)) clear(); }); };
        handler.postDelayed(expiry, 120000);
    }
    private void clear() {
        if (expiry != null) handler.removeCallbacks(expiry);
        expiry = null;
        if (staged != null) staged.delete();
        staged = null; token = null; pendingPicker = null; awaitingPicker = false; expected = 0; written = 0;
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        io.execute(() -> { if (pendingPicker != null) pendingPicker.reject("Export interrupted when the app closed. Start it again."); clear(); });
        io.shutdown();
    }
}
