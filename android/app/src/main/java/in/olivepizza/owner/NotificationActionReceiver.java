package in.olivepizza.owner;

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
    private static final String BACKEND_URL = "https://olive-pizza-owner.onrender.com/api/notifications/action";

    private static final List<String> SILENT_ACTIONS = Arrays.asList(
        "accept_order",
        "accept_delivery"
    );

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String orderId = intent.getStringExtra("orderId");
        int notifId = intent.getIntExtra("notifId", 0);

        Log.i(TAG, "Notification action received: " + action + " for order: " + orderId);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notifId != 0) {
            nm.cancel(notifId);
        }

        if (SILENT_ACTIONS.contains(action)) {
            sendActionToBackend(context, action, orderId);
        } else {
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("action", action);
            launchIntent.putExtra("orderId", orderId);
            context.startActivity(launchIntent);
        }
    }

    private void sendActionToBackend(Context context, String action, String orderId) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Log.w(TAG, "No signed-in Firebase user for background action: " + action);
            showToast(context, "Please open Olive Pizza Owner to perform this action");
            return;
        }

        user.getIdToken(false).addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                Log.e(TAG, "Failed to get auth token for notification action", task.getException());
                showToast(context, "Action failed: authentication error");
                return;
            }

            String idToken = task.getResult().getToken();
            new Thread(() -> {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(BACKEND_URL);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Authorization", "Bearer " + idToken);
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);

                    JSONObject body = new JSONObject();
                    body.put("action", action);
                    body.put("orderId", orderId);
                    body.put("source", "notification_action_native");

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes("UTF-8"));
                    }

                    int responseCode = conn.getResponseCode();
                    if (responseCode >= 200 && responseCode < 300) {
                        Log.i(TAG, "Action " + action + " executed successfully for order " + orderId);
                        showToast(context, getSuccessMessage(action));
                    } else {
                        Log.w(TAG, "Action " + action + " HTTP " + responseCode);
                        showToast(context, "Action failed (server error " + responseCode + ")");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Network failure for notification action " + action, e);
                    showToast(context, "Network error: action could not be completed");
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }).start();
        });
    }

    private String getSuccessMessage(String action) {
        switch (action) {
            case "accept_order":    return "✅ Order accepted!";
            case "accept_delivery": return "✅ Delivery assigned to you!";
            default:                return "✅ Action completed";
        }
    }

    private void showToast(Context context, String message) {
        new Handler(Looper.getMainLooper()).post(() ->
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        );
    }
}
