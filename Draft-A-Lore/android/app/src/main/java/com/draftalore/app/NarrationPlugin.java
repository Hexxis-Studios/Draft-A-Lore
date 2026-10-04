package com.draftalore.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@CapacitorPlugin(name = "Narration")
public class NarrationPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private CompletableFuture<TextToSpeech> initialization;
    private TextToSpeech engine;
    private boolean destroyed;
    private int generation;
    private PluginCall playback;
    private String utteranceId;
    private String playbackText;
    private Bundle speechParameters;
    private int position, segmentStart, attempt;
    private boolean paused;

    private CompletableFuture<TextToSpeech> initialize() {
        if(initialization != null) return initialization;
        initialization = new CompletableFuture<>();
        try { engine = new TextToSpeech(getContext(), status -> main.post(() -> {
            if(destroyed || initialization.isDone()) return;
            if(status == TextToSpeech.SUCCESS) {
                engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onRangeStart(String id, int start, int end, int frame) {
                        main.post(() -> { if(id.equals(utteranceId) && playbackText != null) position = Math.max(position, Math.min(playbackText.length(), segmentStart + start)); });
                    }
                    @Override public void onDone(String id) { finish(id, null); }
                    @Override public void onError(String id) { finish(id, "Device narration failed. Check the installed voice data."); }
                    @Override public void onError(String id, int code) {
                        finish(id, code == TextToSpeech.ERROR_NOT_INSTALLED_YET ? "The selected voice is not installed. Install its voice data in Android settings." : "Device narration failed (" + code + "). Your manuscript is unchanged.");
                    }
                });
                initialization.complete(engine);
            } else initialization.completeExceptionally(new IllegalStateException("No working Android speech engine is installed."));
        })); } catch(Exception failure) {
            initialization.completeExceptionally(new IllegalStateException("Android speech initialization failed: " + failure.getMessage()));
        }
        main.postDelayed(() -> {
            if(!initialization.isDone()) {
                initialization.completeExceptionally(new IllegalStateException("The Android speech engine did not respond. Check device speech settings."));
                if(engine != null) engine.shutdown();
            }
        }, 15000);
        return initialization;
    }

    private void finish(String id, String error) {
        main.post(() -> {
            if(playback == null || !id.equals(utteranceId)) return;
            PluginCall call = playback;
            playback = null;
            utteranceId = null;
            playbackText = null;
            speechParameters = null;
            paused = false;
            if(error == null) call.resolve(); else call.reject(error);
        });
    }

    @PluginMethod public void capabilities(PluginCall call) {
        main.post(() -> {
            if(destroyed) { call.reject("Narration is unavailable after closing the app."); return; }
            initialize().whenComplete((tts, error) -> main.post(() -> {
                if(error != null) { call.reject(error.getMessage()); return; }
                try {
                    JSArray voices = new JSArray();
                    Set<Voice> available = tts.getVoices();
                    if(available != null) for(Voice voice : available) {
                        if(voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                        JSObject entry = new JSObject();
                        entry.put("name", voice.getName());
                        entry.put("lang", voice.getLocale().toLanguageTag());
                        entry.put("localService", !voice.isNetworkConnectionRequired());
                        voices.put(entry);
                    }
                    JSObject result = new JSObject();
                    result.put("voices", voices);
                    result.put("available", voices.length() > 0);
                    result.put("pause", true);
                    result.put("resumePosition", "last-reported-word-or-segment-start");
                    call.resolve(result);
                } catch(Exception failure) { call.reject("Could not inspect Android speech voices: " + failure.getMessage()); }
            }));
        });
    }

    @PluginMethod public void speak(PluginCall call) {
        main.post(() -> {
            if(destroyed) { call.reject("Narration is unavailable after closing the app."); return; }
            int requestGeneration = ++generation;
            cancelPlayback();
            initialize().whenComplete((tts, error) -> main.post(() -> {
                if(requestGeneration != generation || destroyed) { call.reject("Narration was stopped."); return; }
                if(error != null) { call.reject(error.getMessage()); return; }
                try {
                    String text = call.getString("text", "");
                    if(text.isEmpty() || text.length() > Math.min(1200, TextToSpeech.getMaxSpeechInputLength())) { call.reject("The narration segment is empty or too long."); return; }
                    String name = call.getString("voice", "");
                    Locale locale = Locale.forLanguageTag(call.getString("language", Locale.getDefault().toLanguageTag()));
                    if(locale.getLanguage().isEmpty()) locale = Locale.getDefault();
                    boolean online = Boolean.TRUE.equals(call.getBoolean("online", false));
                    Voice selected = null;
                    Set<Voice> voices = tts.getVoices();
                    if(voices != null) for(Voice candidate : voices) {
                        if(candidate.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                        if(candidate.isNetworkConnectionRequired() && !online) continue;
                        if(!name.isEmpty()) { if(candidate.getName().equals(name)) { selected = candidate; break; } }
                        else if(candidate.getLocale().getLanguage().equals(locale.getLanguage())) {
                            if(selected == null || (candidate.getLocale().equals(locale) && !selected.getLocale().equals(locale)) || (candidate.getLocale().equals(selected.getLocale()) && selected.isNetworkConnectionRequired() && !candidate.isNetworkConnectionRequired())) selected = candidate;
                        }
                    }
                    if(selected == null) { call.reject("No installed voice matches this language or selected voice. Choose an installed voice in Android speech settings."); return; }
                    if(tts.setVoice(selected) == TextToSpeech.ERROR) { call.reject("The selected Android voice could not be activated."); return; }
                    double rate = call.getDouble("rate", 1.0), pitch = call.getDouble("pitch", 1.0), volume = call.getDouble("volume", 1.0);
                    if(!Double.isFinite(rate) || !Double.isFinite(pitch) || !Double.isFinite(volume)) { call.reject("Narration settings must be finite numbers."); return; }
                    if(tts.setSpeechRate((float)Math.max(0.5, Math.min(2.0, rate))) == TextToSpeech.ERROR || tts.setPitch((float)Math.max(0.1, Math.min(2.0, pitch))) == TextToSpeech.ERROR) { call.reject("This speech engine does not support the selected narration settings."); return; }
                    Bundle params = new Bundle();
                    params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (float)Math.max(0.0, Math.min(1.0, volume)));
                    playback = call;
                    playbackText = text;
                    speechParameters = params;
                    position = 0;
                    paused = false;
                    startSegment();
                } catch(Exception failure) {
                    if(playback == call) { playback = null; utteranceId = null; }
                    call.reject("Android narration could not start: " + failure.getMessage());
                }
            }));
        });
    }

    private void cancelPlayback() {
        PluginCall previous = playback;
        playback = null;
        utteranceId = null;
        playbackText = null;
        speechParameters = null;
        paused = false;
        if(engine != null) try { engine.stop(); } catch(Exception ignored) {}
        if(previous != null) previous.reject("Narration was stopped.");
    }

    private void startSegment() {
        segmentStart = position;
        utteranceId = "draftalore-" + generation + "-" + (++attempt);
        if(engine.speak(playbackText.substring(position), TextToSpeech.QUEUE_FLUSH, speechParameters, utteranceId) == TextToSpeech.ERROR) finish(utteranceId, "Android could not start narration.");
        String queuedId = utteranceId;
        main.postDelayed(() -> {
            if(!queuedId.equals(utteranceId)) return;
            try { engine.stop(); } catch(Exception ignored) {}
            finish(queuedId, "The speech engine stopped responding. Start narration again or check Android speech settings.");
        }, 300000);
    }

    @PluginMethod public void pause(PluginCall call) {
        main.post(() -> {
            if(playback == null || paused) { call.reject("There is no active narration to pause."); return; }
            utteranceId = null;
            try { engine.stop(); paused = true; call.resolve(); }
            catch(Exception failure) { cancelPlayback(); call.reject("Android narration could not pause."); }
        });
    }

    @PluginMethod public void resume(PluginCall call) {
        main.post(() -> {
            if(playback == null || !paused) { call.reject("There is no paused narration to resume."); return; }
            try { paused = false; startSegment(); call.resolve(); }
            catch(Exception failure) { cancelPlayback(); call.reject("Android narration could not resume."); }
        });
    }

    @PluginMethod public void stop(PluginCall call) {
        main.post(() -> { generation++; cancelPlayback(); call.resolve(); });
    }

    @Override protected void handleOnPause() {
        main.post(() -> { generation++; cancelPlayback(); });
    }

    @Override protected void handleOnDestroy() {
        main.post(() -> {
            destroyed = true;
            generation++;
            cancelPlayback();
            if(initialization != null && !initialization.isDone()) initialization.completeExceptionally(new IllegalStateException("Narration was closed."));
            if(engine != null) { engine.shutdown(); engine = null; }
        });
    }
}
