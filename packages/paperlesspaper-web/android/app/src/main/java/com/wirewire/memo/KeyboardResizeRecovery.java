package de.wirewire.wirewire;

import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Repairs a keyboard margin left behind by Capacitor 8's SystemBars plugin. */
final class KeyboardResizeRecovery implements ViewTreeObserver.OnGlobalLayoutListener {
    private final View content;

    KeyboardResizeRecovery(View content) {
        this.content = content;
        content.getViewTreeObserver().addOnGlobalLayoutListener(this);
    }

    @Override
    public void onGlobalLayout() {
        restoreIfKeyboardHidden(content, ViewCompat.getRootWindowInsets(content));
    }

    void refresh() {
        // Focus/resume callbacks can precede the latest IME insets. Request a
        // new dispatch; the layout listener then reconciles the settled state.
        ViewCompat.requestApplyInsets(content);
    }

    void dispose() {
        if (content.getViewTreeObserver().isAlive()) {
            content.getViewTreeObserver().removeOnGlobalLayoutListener(this);
        }
    }

    static void restoreIfKeyboardHidden(View content, WindowInsetsCompat insets) {
        if (insets == null || insets.isVisible(WindowInsetsCompat.Type.ime())) {
            return;
        }

        // SystemBars only clears this margin while the window has focus and
        // is shown. IME dismissal behind a native dialog/backgrounded app can
        // miss that branch. Do not gate the repair on focus or visibility.
        ViewGroup.LayoutParams params = content.getLayoutParams();
        if (params instanceof ViewGroup.MarginLayoutParams) {
            ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) params;
            if (margins.bottomMargin != 0) {
                margins.bottomMargin = 0;
                content.setLayoutParams(margins);
            }
        }
    }
}
