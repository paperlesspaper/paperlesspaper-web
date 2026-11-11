package de.wirewire.wirewire;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class KeyboardResizeRecoveryTest {
    private WindowInsetsCompat keyboard(boolean visible) {
        return new WindowInsetsCompat.Builder()
            .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, visible ? 900 : 0))
            .setVisible(WindowInsetsCompat.Type.ime(), visible)
            .build();
    }

    private View content() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        View view = new View(context);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, -1);
        params.setMargins(11, 22, 33, 900);
        view.setLayoutParams(params);
        return view;
    }

    @Test
    public void restoresFullHeightWithoutWindowFocus() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            View view = content();
            FrameLayout parent = new FrameLayout(view.getContext());
            parent.addView(view);
            int width = View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY);
            int height = View.MeasureSpec.makeMeasureSpec(2000, View.MeasureSpec.EXACTLY);
            parent.measure(width, height);
            assertEquals(1078, view.getMeasuredHeight());
            assertFalse(view.hasWindowFocus());

            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, keyboard(false));
            parent.measure(width, height);
            assertEquals(1978, view.getMeasuredHeight());
            FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) view.getLayoutParams();
            assertEquals(11, params.leftMargin);
            assertEquals(22, params.topMargin);
            assertEquals(33, params.rightMargin);
        });
    }

    @Test
    public void preservesSpaceWhileKeyboardIsVisibleOrInsetsAreUnknown() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            View view = content();
            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, keyboard(true));
            assertEquals(900, ((ViewGroup.MarginLayoutParams) view.getLayoutParams()).bottomMargin);
            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, null);
            assertEquals(900, ((ViewGroup.MarginLayoutParams) view.getLayoutParams()).bottomMargin);
        });
    }

    @Test
    public void restoresHiddenContentBeforeItBecomesVisibleAgain() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            View view = content();
            view.setVisibility(View.GONE);
            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, keyboard(false));
            assertEquals(0, ((ViewGroup.MarginLayoutParams) view.getLayoutParams()).bottomMargin);
        });
    }

    @Test
    public void repeatedHiddenInsetsDoNotRequestAnotherLayout() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            View view = content();
            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, keyboard(false));
            view.layout(0, 0, 1080, 2000);
            assertFalse(view.isLayoutRequested());
            KeyboardResizeRecovery.restoreIfKeyboardHidden(view, keyboard(false));
            assertFalse(view.isLayoutRequested());
        });
    }

    @Test
    public void activityAutomaticallyRepairsStaleMarginOnNextLayout() throws Exception {
        org.junit.Assume.assumeTrue(android.os.Build.VERSION.SDK_INT >= 35);
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(
            new Intent(instrumentation.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        );
        try {
            instrumentation.waitForIdleSync();
            instrumentation.runOnMainSync(() -> {
                View content = (View) activity.getBridge().getWebView().getParent();
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(content);
                assertNotNull(insets);
                assertFalse(insets.isVisible(WindowInsetsCompat.Type.ime()));
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) content.getLayoutParams();
                params.bottomMargin = 900;
                content.setLayoutParams(params);
            });
            AtomicInteger margin = new AtomicInteger(900);
            for (int i = 0; i < 50 && margin.get() != 0; i++) {
                Thread.sleep(100);
                instrumentation.runOnMainSync(() -> {
                    View content = (View) activity.getBridge().getWebView().getParent();
                    margin.set(((ViewGroup.MarginLayoutParams) content.getLayoutParams()).bottomMargin);
                });
            }
            assertEquals("Activity must recover without a JS keyboard callback", 0, margin.get());
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
