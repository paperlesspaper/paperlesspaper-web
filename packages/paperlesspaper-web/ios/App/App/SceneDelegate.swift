import UIKit

/// iOS 27 requires a scene lifecycle for apps built with the iOS 27 SDK.
/// Main.storyboard still creates the existing Capacitor bridge controller.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }

        // Keep the single-window reference available to legacy native plugins.
        (UIApplication.shared.delegate as? AppDelegate)?.window = window

        // Cold-start URLs arrive with the scene, before the usual open-URL
        // callbacks. Load the bridge first so its plugins can retain the event
        // until JavaScript installs its listeners.
        window?.rootViewController?.loadViewIfNeeded()
        forwardURLContexts(connectionOptions.urlContexts)
        for userActivity in connectionOptions.userActivities {
            forwardUserActivity(userActivity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        forwardURLContexts(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forwardUserActivity(userActivity)
    }

    private func forwardURLContexts(_ contexts: Set<UIOpenURLContext>) {
        guard let delegate = UIApplication.shared.delegate as? AppDelegate else { return }
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let sourceApplication = context.options.sourceApplication {
                options[.sourceApplication] = sourceApplication
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            // Preserve Google Sign-In, Capacitor appUrlOpen, and share-target
            // routing through the existing app delegate.
            _ = delegate.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    private func forwardUserActivity(_ userActivity: NSUserActivity) {
        guard let delegate = UIApplication.shared.delegate as? AppDelegate else { return }
        _ = delegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
