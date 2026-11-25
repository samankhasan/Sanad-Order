package com.sanadcompany.sanadorder;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Let Capacitor switch from the launch (splash) theme to AppTheme.NoActionBar and
        // create the WebView FIRST. Touching the window before this (as EdgeToEdge.enable did)
        // froze the launch theme and showed an ActionBar with a stretched splash logo.
        super.onCreate(savedInstanceState);

        // Edge-to-edge: draw behind transparent status & navigation bars on every Android
        // version. The web app pads itself with the real insets (capacitor-plugin-safe-area).
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }
}
