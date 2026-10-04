package com.draftalore.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

@CapacitorPlugin(name = "GoogleBackup")
public class GoogleBackupPlugin extends Plugin {
    private static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;
    private Runnable timeout;
    private String accessToken;
    private int generation;
    private boolean resolving;

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), result -> {
                resolving = false;
                if (pending == null) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                    fail("Google backup access was cancelled. Your local projects are unchanged.");
                    return;
                }
                try {
                    accept(Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(result.getData()));
                } catch (Exception error) {
                    fail("Google backup access was not granted. Your local projects are unchanged.");
                }
            }
        );
    }

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) == ConnectionResult.SUCCESS);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending != null || resolving) {
                call.reject("Close the current Google consent screen before connecting again.");
                return;
            }
            if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) != ConnectionResult.SUCCESS) {
                call.reject("Google Play services are unavailable or need updating. Local backups still work.");
                return;
            }
            pending = call;
            int attempt = ++generation;
            timeout = () -> { if (generation == attempt) fail("Google sign-in timed out. No files were uploaded."); };
            handler.postDelayed(timeout, 180000);
            AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope(SCOPE)))
                .setOptOutIncludingGrantedScopes(true)
                .setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
                .build();
            Identity.getAuthorizationClient(getActivity()).authorize(request)
                .addOnSuccessListener(getActivity(), result -> {
                    if (generation != attempt || pending != call) return;
                    if (result.hasResolution()) {
                        try {
                            if (result.getPendingIntent() == null) throw new IllegalStateException();
                            resolving = true;
                            launcher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
                        } catch (Exception error) {
                            resolving = false;
                            fail("Google sign-in could not open. Your local projects are unchanged.");
                        }
                    } else accept(result);
                })
                .addOnFailureListener(getActivity(), error -> {
                    if (generation == attempt && pending == call) fail("Google sign-in failed. Check your connection and retry; local projects are unchanged.");
                });
        });
    }

    private void accept(AuthorizationResult result) {
        String token = result.getAccessToken();
        if (pending == null) return;
        if (token == null || token.isEmpty() || result.getGrantedScopes() == null || !result.getGrantedScopes().contains(SCOPE)) {
            fail("Google did not grant private backup access. Your local projects are unchanged.");
            return;
        }
        accessToken = token;
        PluginCall call = pending;
        clearPending();
        JSObject response = new JSObject();
        response.put("accessToken", token);
        response.put("expiresIn", 3000);
        response.put("scope", SCOPE);
        call.resolve(response);
    }

    private void clearPending() {
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        pending = null;
        generation++;
    }

    private void fail(String message) {
        PluginCall call = pending;
        clearPending();
        if (call != null) call.reject(message);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            fail("Google connection was cancelled.");
            String token = accessToken;
            accessToken = null;
            if (token == null) { call.resolve(); return; }
            Identity.getAuthorizationClient(getActivity())
                .clearToken(ClearTokenRequest.builder().setToken(token).build())
                .addOnSuccessListener(unused -> call.resolve())
                .addOnFailureListener(error -> call.reject("The local connection was closed, but Google’s cached authorization could not be cleared. Manage access in your Google Account."));
        });
    }

    @Override
    protected void handleOnDestroy() {
        fail("Google connection was interrupted when the app closed.");
        accessToken = null;
        if (launcher != null) launcher.unregister();
    }
}
