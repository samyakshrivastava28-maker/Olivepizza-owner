package in.olivepizza.owner;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.BridgeActivity;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Firebase Test Lab Smoke Test for owner app.
 * Verifies application launch, Activity lifecycle, and Capacitor WebView container attachment.
 */
@RunWith(AndroidJUnit4.class)
public class MainActivitySmokeTest {

    @Test
    public void testApplicationContextInit() {
        Context context = ApplicationProvider.getApplicationContext();
        assertNotNull("Application context must be initialized", context);
        assertEquals("in.olivepizza.owner", context.getPackageName());
    }

    @Test
    public void testMainActivityLaunchesWithoutCrash() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertNotNull("MainActivity instance must exist", activity);
                assertFalse("MainActivity should not be finishing prematurely", activity.isFinishing());
                assertTrue("MainActivity must extend Capacitor BridgeActivity", activity instanceof BridgeActivity);
                assertNotNull("Window must be non-null", activity.getWindow());
                assertNotNull("DecorView must be attached", activity.getWindow().getDecorView());
            });
        }
    }
}
