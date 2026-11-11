import Capacitor
import WebKit

class BridgeViewController: CAPBridgeViewController {
    private var cookiesEnabled = false
    private var httpEnabled = false

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        cookiesEnabled = instanceConfiguration.getPluginConfig("CapacitorCookies").getBoolean("enabled", false)
        httpEnabled = instanceConfiguration.getPluginConfig("CapacitorHttp").getBoolean("enabled", false)
        return super.webViewConfiguration(for: instanceConfiguration)
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        if #available(iOS 27.0, *) {
            // Capacitor's document-start script asks for these two native flags
            // using synchronous prompts. WebKit on iOS 27 can stall before it
            // delivers those prompts to WKUIDelegate, leaving an empty page.
            // Install before Capacitor's scripts and restore the real prompt
            // after both configuration reads. Ordinary prompts keep working.
            let bootstrap = """
            (() => {
                const originalPrompt = window.prompt;
                const settings = {
                    'CapacitorCookies.isEnabled': '\(cookiesEnabled)',
                    'CapacitorHttp': '\(httpEnabled)'
                };
                const pending = new Set(Object.keys(settings));
                window.prompt = function(message, defaultText) {
                    let type;
                    try {
                        type = JSON.parse(message)?.type;
                    } catch (_) {}
                    if (Object.prototype.hasOwnProperty.call(settings, type)) {
                        pending.delete(type);
                        if (pending.size === 0) window.prompt = originalPrompt;
                        return settings[type];
                    }
                    return originalPrompt.apply(window, arguments);
                };
            })();
            """
            configuration.userContentController.addUserScript(WKUserScript(
                source: bootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
        }
        return super.webView(with: frame, configuration: configuration)
    }
}
