package com.draftalore.app;

import android.os.LocaleList;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceLocale")
public class LocalePlugin extends Plugin {
    @PluginMethod
    public void languages(PluginCall call) {
        LocaleList locales = LocaleList.getDefault();
        JSArray languages = new JSArray();
        for (int index = 0; index < locales.size(); index++) {
            languages.put(locales.get(index).toLanguageTag());
        }
        JSObject result = new JSObject();
        result.put("languages", languages);
        call.resolve(result);
    }
}
