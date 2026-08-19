package com.olivepizza.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

import android.os.PowerManager;

/**
 * Olive Pizza — Custom Firebase Messaging Service (Production Grade)
 *
 * RESPONSIBILITIES:
 *  1. Receive ALL FCM messages (data-only AND notification+data).
 *  2. For continuous alarms (alert=continuous) and ongoing trackers (ongoing=true),
 *     build a native notification with the correct channel, sound, full-screen intent,
 *     and action buttons — REGARDLESS of whether the app process is alive or dead.
 *  3. Turn screen physically ON immediately when a critical alarm arrives.
 *  4. Register refreshed FCM tokens natively (onNewToken) so killed-app delivery
 *     always has a valid token.
 */
public class OliveMessagingService extends MessagingService {
    private static final String TAG = "OliveMessagingService";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // 1. Acquire Partial WakeLock to ensure CPU doesn't sleep while processing
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OlivePizza::NotificationWakeLock");
            wakeLock.acquire(15000); // 15 seconds max for message processing
        }

        boolean handledNatively = false;

        try {
            Map<String, String> data = new HashMap<>(remoteMessage.getData());

            // If a notification block is present, normalize fallback fields
            RemoteMessage.Notification notif = remoteMessage.getNotification();
            if (notif != null) {
                if (!data.containsKey("title") && notif.getTitle() != null) {
                    data.put("title", notif.getTitle());
                }
                if (!data.containsKey("body") && notif.getBody() != null) {
                    data.put("body", notif.getBody());
                }
                if (!data.containsKey("clickAction") && notif.getClickAction() != null) {
                    data.put("clickAction", notif.getClickAction());
                }
            }

            Log.d(TAG, "Normalized data payload: " + data);

            if (data.size() > 0) {
                String alert = data.get("alert");
                String category = data.get("category");
                String stage = data.get("stage");
                String action = data.get("action");

                boolean isStaff = "owner".equalsIgnoreCase(data.get("role")) || "delivery_partner".equalsIgnoreCase(data.get("role")) || "delivery".equalsIgnoreCase(data.get("role")) ||
                                  "owner".equalsIgnoreCase(data.get("targetRole")) || "delivery_partner".equalsIgnoreCase(data.get("targetRole")) || "delivery".equalsIgnoreCase(data.get("targetRole")) ||
                                  "alarm_actionable".equalsIgnoreCase(category);

                boolean isContinuousAlert = isStaff && ("continuous".equals(alert) || 
                                            "alarm_actionable".equals(category) || 
                                            "new_order".equals(stage) || 
                                            "delivery_assigned".equals(stage));

                if ("stop_alert".equals(action)) {
                    stopNativeAlarm(data);
                    handledNatively = true;
                } else {
                    if (isContinuousAlert) {
                        wakeScreenOnEmergency(powerManager);
                    }
                    showNativeNotification(data);
                    handledNatively = true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing native notification", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }

        // Only pass to super if NOT handled natively AND a notification block exists
        if (!handledNatively && remoteMessage.getNotification() != null) {
            try {
                super.onMessageReceived(remoteMessage);
            } catch (Exception e) {
                Log.e(TAG, "Capacitor MessagingService call safe catch (expected if app is closed)", e);
            }
        }
    }

    /**
     * Resolves valid notification small icon resource ID, avoiding 0 which causes blank notifications.
     */
    private int getSmallIconResId() {
        int resId = getResources().getIdentifier("ic_stat_icon_config_sample", "drawable", getPackageName());
        if (resId == 0) {
            resId = getApplicationInfo().icon;
        }
        if (resId == 0) {
            resId = android.R.drawable.ic_dialog_info;
        }
        return resId;
    }

    /**
     * Physically wakes screen up from black/sleeping state when an order alarm arrives.
     */
    private void wakeScreenOnEmergency(PowerManager powerManager) {
        if (powerManager == null) return;
        try {
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock screenLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "OlivePizza::EmergencyScreenWakeLock"
            );
            screenLock.acquire(10000); // 10 seconds to display screen
            Log.d(TAG, "⚡ Emergency screen wake lock acquired!");
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire screen wake lock: " + e.getMessage());
        }
    }

    private void showNativeNotification(Map<String, String> data) {
        String category = data.get("category");
        String stage = data.get("stage");

        String defaultTitle = "Olive Pizza";
        String defaultBody = "You have a new update";

        if ("alarm_actionable".equals(category) || "new_order".equals(stage)) {
            defaultTitle = "🍕 New Order Received";
            defaultBody = "New high-priority order alert";
        } else if ("delivery_assigned".equals(stage) || "partner_assigned".equals(stage)) {
            defaultTitle = "🛵 Delivery Partner Assigned";
            defaultBody = "New delivery route assignment ready";
        } else if ("pinned_live".equals(category) || "order_update".equals(stage)) {
            defaultTitle = "🛵 Live Order Update";
            defaultBody = "Your order status has been updated";
        } else if ("marketing".equals(category)) {
            defaultTitle = "🎁 Olive Pizza Offer";
            defaultBody = "Check out today's special deal";
        }

        String title = data.get("title") != null ? data.get("title") : defaultTitle;
        String body = data.get("body") != null ? data.get("body") : defaultBody;
        String orderId = data.get("orderId");
        String soundName = data.get("sound");
        boolean isOngoing = "true".equals(data.get("ongoing"));
        String alertType = data.get("alert");

        String role = data.get("role");
        String targetRole = data.get("targetRole");
        boolean isStaff = "owner".equalsIgnoreCase(role) || "delivery_partner".equalsIgnoreCase(role) || "delivery".equalsIgnoreCase(role) ||
                          "owner".equalsIgnoreCase(targetRole) || "delivery_partner".equalsIgnoreCase(targetRole) || "delivery".equalsIgnoreCase(targetRole) ||
                          "alarm_actionable".equalsIgnoreCase(category);

        boolean isContinuous = isStaff && ("continuous".equals(alertType) || 
                               "alarm_actionable".equals(category) || 
                               "new_order".equals(stage) || 
                               "delivery_assigned".equals(stage));

        int notificationId = (orderId != null) 
            ? (isOngoing ? orderId.hashCode() : (orderId.hashCode() + 1000))
            : (int) (System.currentTimeMillis() & 0x7fffffff);

        String channelId = data.get("channelId");
        if (channelId == null || channelId.isEmpty()) {
            channelId = isContinuous ? MainActivity.CHANNEL_ORDER_NEW : (isOngoing ? MainActivity.CHANNEL_ORDER_STATUS : MainActivity.CHANNEL_ORDER_STATUS);
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Ensure channel exists with MAX importance and USAGE_ALARM for emergency alarms
        ensureChannelExists(notificationManager, channelId, isContinuous, isOngoing, soundName);

        Intent intent;
        if (isContinuous && isStaff && orderId != null) {
            intent = new Intent(this, AlarmActivity.class);
            intent.putExtra("orderId", orderId);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try {
                startActivity(intent);
                Log.d(TAG, "⚡ AlarmActivity started directly from OliveMessagingService for staff role");
            } catch (Exception e) {
                Log.e(TAG, "Could not start AlarmActivity directly: " + e.getMessage());
            }
        } else {
            intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("url", data.get("url"));
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(getSmallIconResId())
                .setContentTitle(title != null && !title.isEmpty() ? title : "Olive Pizza")
                .setContentText(body != null && !body.isEmpty() ? body : "You have a new update")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null && !body.isEmpty() ? body : (title != null ? title : "")))
                .setContentIntent(pendingIntent)
                .setDefaults(Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        // Explicitly set sound on builder
        Uri soundUri = null;
        if (soundName != null && !soundName.isEmpty() && !"default".equals(soundName)) {
            String cleanSoundName = soundName.contains(".") ? soundName.split("\\.")[0] : soundName;
            int resId = getResources().getIdentifier(cleanSoundName, "raw", getPackageName());
            if (resId != 0) {
                soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        }
        if (soundUri == null) {
            soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
        }
        builder.setSound(soundUri);

        if (isOngoing) {
            builder.setOngoing(true).setOnlyAlertOnce(true);

            String status = data.get("stage");
            if ("delivered".equals(status) || "cancelled".equals(status) || "completed".equals(status)) {
                notificationManager.cancel(notificationId);
                builder.setOngoing(false).setAutoCancel(true);
                notificationManager.notify(notificationId + 1, builder.build());
                return;
            }
        } else {
            builder.setPriority(NotificationCompat.PRIORITY_MAX)
                   .setCategory(NotificationCompat.CATEGORY_ALARM)
                   .setAutoCancel(true);
            if (isContinuous && pendingIntent != null) {
                builder.setFullScreenIntent(pendingIntent, true);
            }
        }

        // Action Buttons (Accept / Reject / Stop Alert)
        String actionsStr = data.get("actions");
        if (actionsStr != null && orderId != null) {
            try {
                JSONArray actionsArr = new JSONArray(actionsStr);
                for (int i = 0; i < actionsArr.length(); i++) {
                    JSONObject actionObj = actionsArr.getJSONObject(i);
                    String actionName = actionObj.getString("action");
                    String actionTitle = actionObj.getString("title");

                    Intent actionIntent = new Intent(this, NotificationActionReceiver.class);
                    actionIntent.setAction(actionName);
                    actionIntent.putExtra("orderId", orderId);
                    actionIntent.putExtra("notificationId", notificationId);

                    PendingIntent actionPendingIntent = PendingIntent.getBroadcast(
                            this,
                            orderId.hashCode() + i,
                            actionIntent,
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                    );
                    builder.addAction(0, actionTitle, actionPendingIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing actions", e);
            }
        }

        Notification notification = builder.build();

        if (isContinuous) {
            notification.flags |= Notification.FLAG_INSISTENT; // Loop alarm sound continuously
        }

        notificationManager.notify(notificationId, notification);
        Log.i(TAG, "🔔 Native notification posted: id=" + notificationId + " channel=" + channelId + " continuous=" + isContinuous);
    }

    private void ensureChannelExists(NotificationManager notificationManager,
                                     String channelId, boolean isContinuous, boolean isOngoing,
                                     String soundName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (notificationManager.getNotificationChannel(channelId) != null) return;

        int importance = isContinuous ? NotificationManager.IMPORTANCE_MAX :
                         (isOngoing ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel channel = new NotificationChannel(channelId, channelId.replace("_", " "), importance);

        Uri soundUri = null;
        if (soundName != null && !soundName.isEmpty() && !"default".equals(soundName)) {
            String cleanSoundName = soundName.contains(".") ? soundName.split("\\.")[0] : soundName;
            int resId = getResources().getIdentifier(cleanSoundName, "raw", getPackageName());
            if (resId != 0) {
                soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        }
        if (soundUri == null) {
            soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(isContinuous ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
                .build();
        channel.setSound(soundUri, audioAttributes);

        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        try {
            channel.setBypassDnd(true);
        } catch (Exception e) {
            Log.w(TAG, "Failed to set Bypass DND: " + e.getMessage());
        }
        notificationManager.createNotificationChannel(channel);
    }

    private void stopNativeAlarm(Map<String, String> data) {
        String orderId = data.get("orderId");
        if (orderId != null) {
            int notificationId = orderId.hashCode() + 1000;
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(notificationId);
            }
        }
    }

    public static void stopAlarm(Context context, int notificationId) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(notificationId);
        }
    }

    public static void stopAlarm() {}

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed FCM token: " + token);
        MainActivity.registerTokenNatively(this, token, null);
    }
}
