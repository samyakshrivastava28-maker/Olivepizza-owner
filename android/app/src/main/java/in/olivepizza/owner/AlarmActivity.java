package in.olivepizza.owner;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;

public class AlarmActivity extends Activity {
    private static final String TAG = "OliveAlarmActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.w(TAG, "OWNER_NATIVE_ALARM_BLOCKED: Full-screen operational alarm blocked in Owner app. Finishing activity.");
        finish();
    }
}
