package com.draftalore.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BookPrint")
public class BookPrintPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView printView;
    private PluginCall preparing;
    private Runnable timeout;
    private boolean dialogOpened;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html", "");
        String title = call.getString("title", "Draft A Lore Book");
        if (html.isEmpty() || html.length() > 32 * 1024 * 1024) {
            call.reject("The print document is empty or exceeds the 32 MB print limit.");
            return;
        }
        String jobTitle = title.length() > 150 ? title.substring(0, 150) : title;
        getActivity().runOnUiThread(() -> {
            if (printView != null) {
                call.reject("Close the current print dialog before starting another print job.");
                return;
            }
            if (getActivity().isFinishing() || getActivity().isDestroyed()) {
                call.reject("The app is closing. Your writing is unchanged.");
                return;
            }
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (manager == null) {
                call.reject("Android printing is unavailable on this device.");
                return;
            }
            preparing = call;
            dialogOpened = false;
            try {
                printView = new WebView(getActivity());
                printView.getSettings().setJavaScriptEnabled(false);
                printView.getSettings().setAllowFileAccess(false);
                printView.getSettings().setAllowContentAccess(false);
                printView.getSettings().setBlockNetworkLoads(true);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        return true;
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                        if (request.isForMainFrame() && preparing != null) fail("The print document could not load. Your writing is unchanged.");
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (dialogOpened || preparing == null || view != printView) return;
                        dialogOpened = true;
                        if (timeout != null) handler.removeCallbacks(timeout);
                        try {
                            PrintDocumentAdapter delegate = view.createPrintDocumentAdapter(jobTitle);
                            int width = mils(call, "width", 6, 1, 24);
                            int height = mils(call, "height", 9, 1, 36);
                            PrintAttributes attributes = new PrintAttributes.Builder()
                                .setMediaSize(new PrintAttributes.MediaSize("DRAFTALORE_CUSTOM", "Book trim", width, height))
                                .setMinMargins(new PrintAttributes.Margins(mils(call, "left", .9, 0, 48), mils(call, "top", .65, 0, 36), mils(call, "right", .6, 0, 24), mils(call, "bottom", .7, 0, 36)))
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .build();
                            PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                                @Override
                                public void onStart() { delegate.onStart(); }

                                @Override
                                public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                                    delegate.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
                                }

                                @Override
                                public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                                    delegate.onWrite(pages, destination, cancellationSignal, callback);
                                }

                                @Override
                                public void onFinish() {
                                    try { delegate.onFinish(); } finally { cleanup(); }
                                }
                            };
                            if (manager.print(jobTitle, adapter, attributes) == null) throw new IllegalStateException("Print service did not create a job.");
                            JSObject result = new JSObject();
                            result.put("opened", true);
                            PluginCall ready = preparing;
                            preparing = null;
                            ready.resolve(result);
                        } catch (Exception error) {
                            fail("Android could not open the print dialog. Your writing is unchanged.");
                        }
                    }
                });
                timeout = () -> fail("Preparing the print document timed out. Try a smaller document; your writing is unchanged.");
                handler.postDelayed(timeout, 60000);
                printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception error) {
                fail("Android could not prepare printing. Your writing is unchanged.");
            }
        });
    }

    private int mils(PluginCall call, String key, double fallback, double minimum, double maximum) {
        Double value = call.getDouble(key);
        double inches = value == null || !Double.isFinite(value) ? fallback : Math.max(minimum, Math.min(maximum, value));
        return (int) Math.round(inches * 1000);
    }

    private void fail(String message) {
        PluginCall call = preparing;
        preparing = null;
        cleanup();
        if (call != null) call.reject(message);
    }

    private void cleanup() {
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        WebView view = printView;
        printView = null;
        if (view != null) { view.stopLoading(); view.destroy(); }
    }

    @Override
    protected void handleOnDestroy() {
        handler.post(() -> fail("Printing stopped because the app closed. Your writing is unchanged."));
    }
}
