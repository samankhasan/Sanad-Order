package com.sanadcompany.sanadorder;

import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before the bridge starts (this does not touch the window).
        registerPlugin(InstallSourcePlugin.class);

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

    /** Tells the web app which store installed it ("com.android.vending" = Google Play), so the
     *  update notice can send Play users to Play and APK users to the APK download. */
    @CapacitorPlugin(name = "InstallSource")
    public static class InstallSourcePlugin extends Plugin {
        @PluginMethod
        public void get(PluginCall call) {
            String installer = null;
            try {
                PackageManager pm = getContext().getPackageManager();
                String pkg = getContext().getPackageName();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    installer = pm.getInstallSourceInfo(pkg).getInstallingPackageName();
                } else {
                    installer = pm.getInstallerPackageName(pkg);
                }
            } catch (Exception ignored) {
                // unknown installer: treated as "not Google Play"
            }
            JSObject ret = new JSObject();
            ret.put("installer", installer);
            call.resolve(ret);
        }
    }
}
