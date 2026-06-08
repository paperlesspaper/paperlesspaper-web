package de.wirewire.wirewire;

import android.content.res.Configuration;
import android.content.res.Resources;
import android.graphics.Color;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

   private static final int NAVIGATION_BAR_LIGHT_SCRIM = 0xE6FFFFFF;
   private static final int NAVIGATION_BAR_DARK_SCRIM = 0x801B1B1B;

   @Override
   protected void onCreate(Bundle savedInstanceState) {
     EdgeToEdge.enable(
       this,
       SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT, MainActivity::isDarkMode),
       SystemBarStyle.auto(NAVIGATION_BAR_LIGHT_SCRIM, NAVIGATION_BAR_DARK_SCRIM, MainActivity::isDarkMode)
     );
     super.onCreate(savedInstanceState);
   }

   private static boolean isDarkMode(Resources resources) {
     return (resources.getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
   }

   @Override
   public void onActivityResult(int requestCode, int resultCode, Intent data) {
     super.onActivityResult(requestCode, resultCode, data);

     if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
       PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
       if (pluginHandle == null) {
         Log.i("Google Activity Result", "SocialLogin login handle is null");
         return;
       }
       Plugin plugin = pluginHandle.getInstance();
       if (!(plugin instanceof SocialLoginPlugin)) {
         Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
         return;
       }
       ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
     }
   }

   public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
