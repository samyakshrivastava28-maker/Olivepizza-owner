package in.olivepizza.owner;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class AlarmActivity extends Activity {
    private static final String TAG = "OliveAlarmActivity";
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "OlivePizza::AlarmActivityScreenOn"
                );
                wl.acquire(30000);
                wakeLock = wl;
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire screen wake lock: " + e.getMessage());
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        String title = getIntent().getStringExtra("title");
        String message = getIntent().getStringExtra("message");
        String orderId = getIntent().getStringExtra("orderId");
        String soundRaw = getIntent().getStringExtra("sound");

        if (title == null) title = "🚨 NEW ORDER RECEIVED!";
        if (message == null) message = "A new pizza order is waiting for confirmation.";

        buildUi(title, message, orderId);
        startAlarm(soundRaw);
    }

    private void buildUi(String titleText, String messageText, String orderId) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#111827"));
        layout.setPadding(48, 64, 48, 64);

        TextView icon = new TextView(this);
        icon.setText("🍕");
        icon.setTextSize(64);
        icon.setGravity(Gravity.CENTER);
        layout.addView(icon);

        TextView title = new TextView(this);
        title.setText(titleText);
        title.setTextSize(24);
        title.setTextColor(Color.parseColor("#F59E0B"));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 24, 0, 16);
        layout.addView(title);

        TextView msg = new TextView(this);
        msg.setText(messageText);
        msg.setTextSize(16);
        msg.setTextColor(Color.WHITE);
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, 0, 0, 48);
        layout.addView(msg);

        Button acceptBtn = new Button(this);
        acceptBtn.setText("OPEN ORDER");
        acceptBtn.setBackgroundColor(Color.parseColor("#10B981"));
        acceptBtn.setTextColor(Color.WHITE);
        acceptBtn.setTextSize(18);
        acceptBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        acceptBtn.setPadding(32, 24, 32, 24);
        acceptBtn.setOnClickListener(v -> {
            stopAlarm();
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (orderId != null) {
                launchIntent.putExtra("orderId", orderId);
                launchIntent.putExtra("route", "/owner/orders");
            }
            startActivity(launchIntent);
            finish();
        });
        layout.addView(acceptBtn);

        Button dismissBtn = new Button(this);
        dismissBtn.setText("DISMISS ALARM");
        dismissBtn.setBackgroundColor(Color.TRANSPARENT);
        dismissBtn.setTextColor(Color.parseColor("#9CA3AF"));
        dismissBtn.setTextSize(14);
        dismissBtn.setPadding(0, 32, 0, 0);
        dismissBtn.setOnClickListener(v -> {
            stopAlarm();
            finish();
        });
        layout.addView(dismissBtn);

        setContentView(layout);
    }

    private void startAlarm(String soundRaw) {
        try {
            Uri soundUri = null;
            if (soundRaw != null && !"default".equals(soundRaw)) {
                int resId = getResources().getIdentifier(soundRaw, "raw", getPackageName());
                if (resId != 0) {
                    soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
                }
            }
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (soundUri == null) {
                    soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, soundUri);
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()
            );
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to play alarm audio", e);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                @SuppressWarnings("deprecation")
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                vibrator = v;
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 1000, 500, 1000, 500, 1000 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    @SuppressWarnings("deprecation")
                    long[] legacyPattern = pattern;
                    vibrator.vibrate(legacyPattern, 0);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration failed: " + e.getMessage());
        }
    }

    private void stopAlarm() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception ignored) {}

        try {
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
            }
        } catch (Exception ignored) {}

        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        stopAlarm();
        super.onDestroy();
    }
}
