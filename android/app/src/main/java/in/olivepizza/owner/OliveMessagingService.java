package in.olivepizza.owner;

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

public class OliveMessagingService extends MessagingService {
    private static final String TAG = "OliveMessagingService";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        if (data == null) data = new HashMap<>();

        String alertType = data.get("alert");
        boolean isContinuousAlarm = "continuous".equalsIgnoreCase(alertType);
        boolean isOngoing = "true".equalsIgnoreCase(data.get("ongoing"));

        if (isContinuousAlarm) {
            turnScreenOn();
            launchAlarmActivity(data);
        }

        if (isContinuousAlarm || isOngoing || remoteMessage.getNotification() == null) {
            showNativeNotification(remoteMessage, data, isContinuousAlarm, isOngoing);
        } else {
            super.onMessageReceived(remoteMessage);
        }
    }

    private void turnScreenOn() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "OlivePizza::MessagingServiceWake"
                );
                wl.acquire(10000);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to wake screen: " + e.getMessage());
        }
    }

    private void launchAlarmActivity(Map<String, String> data) {
        try {
            Intent intent = new Intent(this, AlarmActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("title", data.get("title"));
            intent.putExtra("message", data.get("body"));
            intent.putExtra("orderId", data.get("orderId"));
            intent.putExtra("sound", data.get("sound"));
            startActivity(intent);
            Log.i(TAG, "AlarmActivity launched for continuous alarm");
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch AlarmActivity directly", e);
        }
    }

    private void showNativeNotification(RemoteMessage remoteMessage, Map<String, String> data,
                                         boolean isContinuousAlarm, boolean isOngoing) {
        String channelId = data.get("channelId");
        if (channelId == null || channelId.isEmpty()) {
            channelId = isContinuousAlarm ? MainActivity.CHANNEL_ORDER_NEW : MainActivity.CHANNEL_ORDER_STATUS;
        }

        String title = data.get("title");
        String body  = data.get("body");
        if (title == null && remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
        }
        if (body == null && remoteMessage.getNotification() != null) {
            body = remoteMessage.getNotification().getBody();
        }
        if (title == null) title = "Olive Pizza Owner";
        if (body == null)  body = "You have a new update.";

        int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        String orderId = data.get("orderId");
        if (orderId != null) {
            try {
                notifId = Math.abs(orderId.hashCode());
            } catch (Exception ignored) {}
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        createChannelIfNeeded(nm, channelId, data.get("sound"), isContinuousAlarm);

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            openAppIntent.putExtra(entry.getKey(), entry.getValue());
        }
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
            this, notifId, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(contentPendingIntent)
            .setAutoCancel(!isOngoing)
            .setOngoing(isOngoing)
            .setPriority(isContinuousAlarm ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(isContinuousAlarm ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (isContinuousAlarm) {
            Intent alarmIntent = new Intent(this, AlarmActivity.class);
            alarmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            alarmIntent.putExtra("title", title);
            alarmIntent.putExtra("message", body);
            alarmIntent.putExtra("orderId", orderId);
            alarmIntent.putExtra("sound", data.get("sound"));
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, notifId + 1, alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
        }

        addActionButtons(builder, data, notifId);

        nm.notify(notifId, builder.build());
        Log.i(TAG, "Native notification displayed (channel=" + channelId + ", id=" + notifId + ")");
    }

    private void addActionButtons(NotificationCompat.Builder builder, Map<String, String> data, int notifId) {
        String actionsJson = data.get("actions");
        if (actionsJson == null || actionsJson.isEmpty()) return;

        try {
            JSONArray actions = new JSONArray(actionsJson);
            for (int i = 0; i < actions.length(); i++) {
                JSONObject actionObj = actions.getJSONObject(i);
                String actionKey   = actionObj.optString("action", actionObj.optString("id"));
                String actionTitle = actionObj.optString("title", actionKey);
                if (actionKey == null || actionKey.isEmpty()) continue;

                Intent actionIntent = new Intent(this, NotificationActionReceiver.class);
                actionIntent.setAction(actionKey);
                actionIntent.putExtra("orderId", data.get("orderId"));
                actionIntent.putExtra("notifId", notifId);
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    actionIntent.putExtra(entry.getKey(), entry.getValue());
                }

                PendingIntent actionPendingIntent = PendingIntent.getBroadcast(
                    this, notifId * 10 + i, actionIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                builder.addAction(0, actionTitle, actionPendingIntent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not parse action buttons: " + e.getMessage());
        }
    }

    private void createChannelIfNeeded(NotificationManager nm, String channelId,
                                        String soundRaw, boolean isAlarm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (nm.getNotificationChannel(channelId) != null) return;

        int importance = isAlarm ? NotificationManager.IMPORTANCE_MAX : NotificationManager.IMPORTANCE_HIGH;
        NotificationChannel channel = new NotificationChannel(channelId, "Olive Alerts", importance);
        channel.enableVibration(true);

        Uri soundUri = null;
        if (soundRaw != null && !"default".equals(soundRaw)) {
            int resId = getResources().getIdentifier(soundRaw, "raw", getPackageName());
            if (resId != 0) {
                soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        }
        if (soundUri == null) {
            soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
        }

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(isAlarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
            .build();
        channel.setSound(soundUri, attrs);

        if (isAlarm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            channel.setBypassDnd(true);
        }

        nm.createNotificationChannel(channel);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM Token refreshed: " + token);
        MainActivity.registerTokenNatively(this, token, null);
    }
}
