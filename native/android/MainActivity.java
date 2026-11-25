package com.sanadcompany.sanadorder;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Draw behind the status & navigation bars on every Android version (Android 15 standard).
        // The web app pads itself using the real insets from capacitor-plugin-safe-area.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
