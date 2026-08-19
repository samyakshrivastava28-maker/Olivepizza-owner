package in.olivepizza.owner;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeliveryPlugin")
public class DeliveryPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String orderId = call.getString("orderId");
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl", "https://olivepizza-owner.onrender.com/api/delivery/location");

        if (orderId == null || token == null) {
            call.reject("Must provide orderId and token");
            return;
        }

        Context context = getContext();
        Intent intent = new Intent(context, DeliveryLocationService.class);
        intent.putExtra("orderId", orderId);
        intent.putExtra("token", token);
        intent.putExtra("apiUrl", apiUrl);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, DeliveryLocationService.class);
        intent.setAction("STOP_SERVICE");
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        
        call.resolve();
    }

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        Context context = getContext();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            boolean isIgnoring = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("isOptimized", !isIgnoring);
            call.resolve(ret);
        } else {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("isOptimized", false);
            call.resolve(ret);
        }
    }
}
