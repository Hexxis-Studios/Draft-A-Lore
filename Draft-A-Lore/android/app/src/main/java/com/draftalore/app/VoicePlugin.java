package com.draftalore.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(name = "Voice", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class VoicePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private int generation;

    @PluginMethod
    public void capabilities(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("recognition", SpeechRecognizer.isRecognitionAvailable(getContext()));
            result.put("offline", Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        call.getData().put("generation", generation);
        if(getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneGranted");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void microphoneGranted(PluginCall call) {
        if(call.getInt("generation", -1) != generation) { call.reject("Dictation was cancelled."); return; }
        if(getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone access was denied.");
            return;
        }
        begin(call);
    }

    private void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if(call.getInt("generation", -1) != generation) { call.reject("Dictation was cancelled."); return; }
            boolean online = Boolean.TRUE.equals(call.getBoolean("online", false));
            if(!online && (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()))) {
                call.reject("No on-device speech recognizer is installed. Use keyboard dictation or explicitly enable online recognition.");
                return;
            }
            dispose();
            int token = generation;
            String sessionId = call.getString("sessionId", "");
            try {
                recognizer = online ? SpeechRecognizer.createSpeechRecognizer(getContext()) : SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    private void emit(String type, String text) {
                        if(token != generation) return;
                        JSObject result = new JSObject();
                        result.put("sessionId", sessionId);
                        result.put("type", type);
                        result.put("text", text);
                        notifyListeners("recognition", result);
                    }
                    private String text(Bundle results) {
                        ArrayList<String> phrases = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        return phrases == null || phrases.isEmpty() ? "" : phrases.get(0);
                    }
                    @Override public void onReadyForSpeech(Bundle params) { emit("ready", ""); }
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rms) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() { emit("processing", ""); }
                    @Override public void onError(int error) {
                        if(token != generation) return;
                        emit("error", recognitionError(error)); dispose();
                    }
                    @Override public void onResults(Bundle results) {
                        if(token != generation) return;
                        emit("final", text(results)); emit("end", ""); dispose();
                    }
                    @Override public void onPartialResults(Bundle results) { emit("partial", text(results)); }
                    @Override public void onEvent(int type, Bundle params) {}
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "en-US"));
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                recognizer.startListening(intent);
                call.resolve();
            } catch(Exception error) { dispose(); call.reject("Speech recognition could not start."); }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if(Boolean.TRUE.equals(call.getBoolean("abort", false))) dispose();
                else if(recognizer != null) recognizer.stopListening();
                else generation++;
                call.resolve();
            } catch(Exception error) {
                dispose();
                call.reject("Speech recognition could not stop normally. Your completed draft is preserved.");
            }
        });
    }

    private String recognitionError(int error) {
        switch(error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "The microphone could not capture audio. Check microphone access or another app using it.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Microphone access was denied. Allow it in Android app permissions to dictate.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "The selected speech service could not connect. Your completed draft is preserved.";
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No clear speech was recognized. Your draft is preserved; try speaking again.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "The speech service is busy. Stop other dictation sessions and try again.";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                return "The selected spoken language is not supported by this speech service.";
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                return "This speech language is not installed. Download its on-device language pack or choose another language.";
            case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:
                return "The speech service needs a short break. Your draft is preserved; try again later.";
            default:
                return "Speech recognition stopped (Android error " + error + "). Your completed draft is preserved.";
        }
    }

    private void dispose() {
        generation++;
        SpeechRecognizer previous = recognizer;
        recognizer = null;
        if(previous != null) {
            try { previous.cancel(); } catch(Exception error) { }
            try { previous.destroy(); } catch(Exception error) { }
        }
    }

    @Override protected void handleOnPause() {
        getActivity().runOnUiThread(() -> {
            if(recognizer != null) {
                JSObject result = new JSObject(); result.put("type", "interrupted");
                notifyListeners("recognition", result);
                dispose();
            }
        });
    }
    @Override protected void handleOnDestroy() { getActivity().runOnUiThread(this::dispose); }
}
