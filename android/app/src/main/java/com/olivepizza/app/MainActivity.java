package com.olivepizza.app;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GetTokenResult;
import com.olivepizza.app.plugins.TruecallerPlugin;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Olive Pizza — Main Activity
 *
 * CRITICAL STARTUP DUTIES (run in onCreate, BEFORE super.onCreate so channels exist
 * before any FCM message could arrive):
 *   1. Create ALL notification channels at startup (never lazily).
 *   2. Register the FCM token natively with the backend (so killed-app delivery has
 *      a valid token even when the web JS bridge isn't running).
 *   3. Prompt owner/delivery users to disable battery optimization (Doze mode defers
 *      high-priority FCM on most OEM Android devices).
 *
 * The channel IDs created here MUST match:
 *   - AndroidManifest meta-data "com.google.firebase.messaging.default_notification_channel_id"
 *   - The channelId sent in the backend payload (NotificationTemplates.ts)
 *   - The channelId used in OliveMessagingService.showNativeNotification()
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "OliveMainActivity";

    // ── Canonical channel IDs (NO suffix variants) ─────────────────────────────
    // These match NotificationTemplates.ANDROID_CHANNELS and the manifest default.
    public static final String CHANNEL_ORDER_NEW           = "olive_order_new";
    public static final String CHANNEL_ORDER_STATUS       = "olive_order_status";
    public static final String CHANNEL_ORDER_COMPLETED    = "olive_order_completed";
    public static final String CHANNEL_DELIVERY_ASSIGN    = "olive_delivery_assignment";
    public static final String CHANNEL_DELIVERY_UPDATES   = "olive_delivery_updates";
    public static final String CHANNEL_MARKETING          = "olive_marketing";
    public static final String CHANNEL_SYSTEM             = "olive_system";

    // Backend URL — must match vercel.json rewrite target + .env RENDER_PUBLIC_URL
    private static final String BACKEND_URL = "https://olive-pizza-backend.onrender.com";

    private static final ExecutorService NETWORK_EXECUTOR = Executors.newSingleThreadExecutor();
    private static volatile boolean batteryPromptShown = false;
    private static final String PREFS_NAME = "olive_role_permissions";
    private static final String KEY_BATTERY_PROMPT_PREFIX = "battery_prompted_";
    private static final String KEY_FULLSCREEN_PROMPT_PREFIX = "fullscreen_prompted_";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 1. Create STANDARD notification channels (customer-safe) at startup
        createStandardNotificationChannels();

        registerPlugin(TruecallerPlugin.class);
        registerPlugin(DeliveryPlugin.class);
        registerPlugin(com.olivepizza.app.plugins.AlarmPermissionPlugin.class);
        super.onCreate(savedInstanceState);

        // 2. Register FCM token natively.
        registerFcmTokenNatively();
    }

    public static boolean isStaffRole(String role) {
        return "owner".equalsIgnoreCase(role) || "delivery_partner".equalsIgnoreCase(role) || "admin".equalsIgnoreCase(role);
    }

    public static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.canUseFullScreenIntent();
        }
        return true;
    }

    public static boolean isIgnoringBatteryOptimizations(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        return true;
    }

    /**
     * Role-Gated Alarm Permission Initialization
     * ONLY invoked when the logged-in user's verified role is owner or delivery_partner.
     * Customers will NEVER receive full-screen alarm prompts or staff channels.
     * Tracks prompt status to avoid repeated intrusive popups.
     */
    public static void setupAlarmPermissionsForStaffRole(Activity activity, String role, boolean forcePrompt) {
        if (activity == null) return;
        if (!isStaffRole(role)) {
            Log.d(TAG, "setupAlarmPermissionsForStaffRole skipped for non-staff role: " + role);
            return;
        }

        // 1. Create Alarm-grade channels (MAX importance, USAGE_ALARM, bypassDnd)
        createStaffAlarmChannels(activity);

        android.content.SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // 2. Prompt for battery-optimization exemption (once per staff role, unless forced)
        String batteryKey = KEY_BATTERY_PROMPT_PREFIX + (role != null ? role.toLowerCase() : "staff");
        if ((forcePrompt || !prefs.getBoolean(batteryKey, false)) && !isIgnoringBatteryOptimizations(activity)) {
            promptBatteryOptimizationExemption(activity);
            prefs.edit().putBoolean(batteryKey, true).apply();
        }

        // 3. Android 14+ Full-Screen Intent Permission Prompt (once per staff role, unless forced)
        String fsKey = KEY_FULLSCREEN_PROMPT_PREFIX + (role != null ? role.toLowerCase() : "staff");
        if ((forcePrompt || !prefs.getBoolean(fsKey, false)) && !canUseFullScreenIntent(activity)) {
            requestFullScreenIntentPermission(activity);
            prefs.edit().putBoolean(fsKey, true).apply();
        }
    }

    public static void requestFullScreenIntentPermission(Activity activity) {
        if (Build.VERSION.SDK_INT >= 34 && activity != null) { // Android 14+ (API 34)
            if (!canUseFullScreenIntent(activity)) {
                Log.w(TAG, "Launching ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT for staff role");
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + activity.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                } catch (Exception e) {
                    Log.w(TAG, "Could not launch ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT: " + e.getMessage());
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTIFICATION CHANNELS — Role-Gated Separation
    // ═══════════════════════════════════════════════════════════════════════════

    private void createStandardNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Customer-safe standard channels
        createChannel(nm, CHANNEL_ORDER_STATUS,     "Olive Order Updates",      NotificationManager.IMPORTANCE_HIGH,    "soft_pop",        false, AudioAttributes.USAGE_NOTIFICATION);
        createChannel(nm, CHANNEL_ORDER_COMPLETED,  "Olive Order Complete",     NotificationManager.IMPORTANCE_HIGH,    "success_ding",    false, AudioAttributes.USAGE_NOTIFICATION);
        createChannel(nm, CHANNEL_DELIVERY_UPDATES, "Olive Delivery Updates",   NotificationManager.IMPORTANCE_HIGH,    "default",         false, AudioAttributes.USAGE_NOTIFICATION);
        createChannel(nm, CHANNEL_MARKETING,        "Olive Promotions",         NotificationManager.IMPORTANCE_DEFAULT, "soft_pop",        false, AudioAttributes.USAGE_NOTIFICATION);
        createChannel(nm, CHANNEL_SYSTEM,          "Olive System Alerts",       NotificationManager.IMPORTANCE_HIGH,    "system_alert",    false, AudioAttributes.USAGE_NOTIFICATION);

        Log.i(TAG, "✅ Standard customer notification channels created.");
    }

    public static void createStaffAlarmChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Alarm channels for owner & delivery partner ONLY
        createChannelStatic(context, nm, CHANNEL_ORDER_NEW, "Olive New Orders", NotificationManager.IMPORTANCE_MAX, "order_alert", true, AudioAttributes.USAGE_ALARM);
        createChannelStatic(context, nm, CHANNEL_DELIVERY_ASSIGN, "Olive Delivery Assign", NotificationManager.IMPORTANCE_MAX, "delivery_chime", true, AudioAttributes.USAGE_ALARM);

        Log.i(TAG, "✅ Staff alarm notification channels created.");
    }

    private static void createChannelStatic(Context context, NotificationManager nm, String id, String name,
                                       int importance, String soundRawName,
                                       boolean bypassDnd, int audioUsage) {
        if (nm.getNotificationChannel(id) != null) return;

        NotificationChannel channel = new NotificationChannel(id, name, importance);
        channel.enableVibration(true);

        Uri soundUri = null;
        if (soundRawName != null && !"default".equals(soundRawName)) {
            int resId = context.getResources().getIdentifier(soundRawName, "raw", context.getPackageName());
            if (resId != 0) {
                soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + resId);
            }
        }
        if (soundUri == null) {
            soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(audioUsage)
                .build();
        channel.setSound(soundUri, audioAttributes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && bypassDnd) {
            channel.setBypassDnd(true);
        }

        nm.createNotificationChannel(channel);
    }

    private void createChannel(NotificationManager nm, String id, String name,
                                int importance, String soundRawName,
                                boolean bypassDnd, int audioUsage) {
        if (nm.getNotificationChannel(id) != null) return; // already exists

        NotificationChannel channel = new NotificationChannel(id, name, importance);
        channel.enableVibration(true);

        // Sound
        Uri soundUri = null;
        if (soundRawName != null && !"default".equals(soundRawName)) {
            int resId = getResources().getIdentifier(soundRawName, "raw", getPackageName());
            if (resId != 0) {
                soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        }
        if (soundUri == null) {
            soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
        }

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(audioUsage)
                .build();
        channel.setSound(soundUri, attrs);

        if (bypassDnd) {
            try {
                channel.setBypassDnd(true);
            } catch (Exception e) {
                Log.w(TAG, "Failed to set Bypass DND for " + id + ": " + e.getMessage());
            }
        }

        // Show badge for new orders + delivery assignments
        channel.setShowBadge(importance >= NotificationManager.IMPORTANCE_HIGH);

        nm.createNotificationChannel(channel);
        Log.d(TAG, "Created channel: " + id + " (importance=" + importance + ")");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NATIVE FCM TOKEN REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Fetches the FCM token natively and POSTs it to the backend.
     * Requires a signed-in Firebase user (for the ID token auth header).
     * If no user is signed in yet, the web JS bridge will handle registration
     * once the user logs in.
     */
    private void registerFcmTokenNatively() {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(new OnCompleteListener<String>() {
                    @Override
                    public void onComplete(@androidx.annotation.NonNull Task<String> task) {
                        if (!task.isSuccessful()) {
                            Log.w(TAG, "Fetching FCM token failed", task.getException());
                            return;
                        }
                        String token = task.getResult();
                        Log.d(TAG, "Native FCM token obtained: " + token);
                        registerTokenNatively(MainActivity.this, token, null);
                    }
                });
    }

    /**
     * Static helper — POSTs the FCM token to /api/notifications/token using the
     * current Firebase user's ID token. Called from:
     *   - MainActivity.registerFcmTokenNatively() (app startup)
     *   - OliveMessagingService.onNewToken() (token refresh while app is dead)
     *
     * @param context  any context (used for device identification)
     * @param token    the FCM registration token
     * @param oldToken previous token if refreshing (null on first registration)
     */
    public static void registerTokenNatively(Context context, String token, String oldToken) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Log.d(TAG, "No signed-in Firebase user — skipping native token registration (web bridge will handle it).");
            return;
        }
        final String uid = user.getUid();
        user.getIdToken(false).addOnCompleteListener(new OnCompleteListener<GetTokenResult>() {
            @Override
            public void onComplete(@androidx.annotation.NonNull Task<GetTokenResult> task) {
                if (!task.isSuccessful()) {
                    Log.w(TAG, "Failed to get ID token for native registration", task.getException());
                    return;
                }
                final String idToken = task.getResult().getToken();
                NETWORK_EXECUTOR.execute(() -> postTokenToBackend(context, uid, token, oldToken, idToken));
            }
        });
    }

    private static void postTokenToBackend(Context context, String uid, String token, String oldToken, String idToken) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(BACKEND_URL + "/api/notifications/token");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + idToken);
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            JSONObject body = new JSONObject();
            body.put("token", token);
            if (oldToken != null) body.put("oldToken", oldToken);
            body.put("deviceId", android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID));
            body.put("deviceName", "Android Native");
            body.put("platform", "android_native");
            body.put("browser", "Capacitor");

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes("UTF-8"));
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                Log.i(TAG, "✅ Native FCM token registered with backend (uid=" + uid + ", code=" + code + ")");
            } else {
                Log.w(TAG, "Native token registration HTTP " + code + " for uid=" + uid);
            }
        } catch (Exception e) {
            Log.e(TAG, "Native token registration failed", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BATTERY OPTIMIZATION EXEMPTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Prompts the user to disable battery optimization for the app.
     * This is critical for killed-app delivery: Doze mode defers high-priority FCM
     * data messages on most OEM Android devices (Xiaomi, Oppo, Vivo, Samsung).
     *
     * The prompt is shown once per install. The web JS layer sets a SharedPreferences
     * flag "battery_prompt_role_set" once the user's role is known (owner/delivery),
     * so we only prompt for roles that need emergency alarms.
     */
    private static void promptBatteryOptimizationExemption(Activity activity) {
        if (batteryPromptShown || activity == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

        PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;

        // Already exempted — nothing to do
        if (pm.isIgnoringBatteryOptimizations(activity.getPackageName())) {
            Log.d(TAG, "App already exempted from battery optimization.");
            return;
        }

        batteryPromptShown = true;
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            Toast.makeText(activity, "Please allow Olive Pizza to run in background for order alarms", Toast.LENGTH_LONG).show();
            Log.i(TAG, "Battery optimization exemption prompt shown for staff role.");
        } catch (Exception e) {
            Log.w(TAG, "Could not show battery optimization prompt: " + e.getMessage());
        }
    }
}
