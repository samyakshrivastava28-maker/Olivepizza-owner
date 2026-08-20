package com.olivepizza.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;
import android.os.PowerManager;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.List;

public class NotificationActionReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationAction";
    private static final String BACKEND_URL = "https://olive-pizza-backend.onrender.com/api/notifications/action";

    /**
     * Silent one-tap actions that complete without opening the app.
     * Anything NOT in this list will launch MainActivity to handle in-app.
     */
    private static final List<String> SILENT_ACTIONS = Arrays.asList(
        "accept_order",
        "accept_delivery"
    );

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String orderId = intent.getStringExtra("orderId");
        int notificationId = intent.getIntExtra("notificationId", -1);

        if (action == null || orderId == null) {
            Log.w(TAG, "Received intent with null action or orderId — ignoring.");
            return;
        }

        Log.d(TAG, "Received action: " + action + " for order: " + orderId);

        // Stop local alarm immediately on this device (before any network call)
        if (notificationId != -1) {
            OliveMessagingService.stopAlarm(context, notificationId);
        }

        // ── UI-requiring actions: reject_order / reject_delivery ──────────────
        // These require a reason; launch the app which shows the modal.
        if (!SILENT_ACTIONS.contains(action)) {
            launchMainActivityWithModal(context, action, orderId, notificationId);
            return;
        }

        // ── Silent actions: authenticate and make backend call ─────────────────
        final PendingResult pendingResult = goAsync();

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Log.e(TAG, "User not authenticated. Cannot perform action.");
            showToast(context, "Cannot complete action: You are logged out.");
            pendingResult.finish();
            return;
        }

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                String token = task.getResult().getToken();
                performBackendAction(context, action, orderId, notificationId, token, pendingResult);
            } else {
                Log.e(TAG, "Failed to get Firebase token", task.getException());
                showToast(context, "Failed to authenticate. Please open the app.");
                pendingResult.finish();
            }
        });
    }

    /**
     * Launches MainActivity with intent extras so the React layer (via Capacitor bridge
     * or MainActivity.onNewIntent) can show the correct cancellation/decline modal.
     *
     * Extras:
     *   openModal  — "cancel_order" or "decline_delivery"
     *   orderId    — the Firestore order document ID
     */
    private void launchMainActivityWithModal(Context context, String action, String orderId, int notificationId) {
        Log.d(TAG, "Launching MainActivity for UI-required action: " + action);

        // Dismiss the notification shade entry
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationId != -1 && nm != null) {
            nm.cancel(notificationId);
        }

        String openModal = action.equals("reject_delivery") ? "decline_delivery" : "cancel_order";

        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("openModal", openModal);
        launch.putExtra("orderId", orderId);
        context.startActivity(launch);
    }

    private void performBackendAction(Context context, String action, String orderId,
                                      int notificationId, String token, PendingResult pendingResult) {
        // Acquire WakeLock so the network call completes even if screen turns off
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
                "OlivePizza::ActionReceiverWakeLock");
            wakeLock.acquire(15000); // Max 15s for network call
        }
        final PowerManager.WakeLock finalWakeLock = wakeLock;

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(BACKEND_URL);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(12000);

                JSONObject payload = new JSONObject();
                payload.put("orderId", orderId);
                payload.put("action", action);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Backend response code: " + responseCode);

                if (responseCode >= 200 && responseCode < 300) {
                    NotificationManager notificationManager =
                        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (notificationId != -1 && notificationManager != null) {
                        notificationManager.cancel(notificationId);
                    }
                    String successMsg = action.equals("accept_order") ? "Order accepted!" : "Delivery accepted!";
                    showToast(context, successMsg);
                } else if (responseCode == 409) {
                    showToast(context, "Already processed — no change needed.");
                } else {
                    showToast(context, "Action failed (" + responseCode + "). Open the app to complete.");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error performing action", e);
                showToast(context, "Network error. Open the app to complete.");
            } finally {
                if (conn != null) conn.disconnect();
                pendingResult.finish();
                if (finalWakeLock != null && finalWakeLock.isHeld()) {
                    finalWakeLock.release();
                }
            }
        }).start();
    }

    private void showToast(Context context, String message) {
        new Handler(Looper.getMainLooper()).post(() ->
            Toast.makeText(context, message, Toast.LENGTH_LONG).show());
    }
}
