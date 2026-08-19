package com.olivepizza.app.plugins;

import android.content.Context;
import android.os.Build;
import android.os.PowerManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.olivepizza.app.MainActivity;

@CapacitorPlugin(name = "AlarmPermission")
public class AlarmPermissionPlugin extends Plugin {

    @PluginMethod
    public void setupPermissions(PluginCall call) {
        if (getActivity() != null) {
            String role = call.getString("role", "customer");
            boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));

            if (!MainActivity.isStaffRole(role)) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("skipped", true);
                ret.put("reason", "Customer role does not require staff alarm permissions");
                call.resolve(ret);
                return;
            }

            getActivity().runOnUiThread(() -> {
                MainActivity.setupAlarmPermissionsForStaffRole(getActivity(), role, force);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("role", role);
                call.resolve(ret);
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("canUseFullScreenIntent", MainActivity.canUseFullScreenIntent(context));
        ret.put("isBatteryOptimized", !MainActivity.isIgnoringBatteryOptimizations(context));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenPermission(PluginCall call) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                MainActivity.requestFullScreenIntentPermission(getActivity());
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                String role = call.getString("role", "owner");
                MainActivity.setupAlarmPermissionsForStaffRole(getActivity(), role, true);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            });
        } else {
            call.reject("Activity is null");
        }
    }
}
