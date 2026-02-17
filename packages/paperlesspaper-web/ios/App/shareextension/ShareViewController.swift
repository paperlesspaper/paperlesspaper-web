import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    let APP_GROUP_ID = "de.wirewire.wirewire.shareextension"  // Same as in capacitor.config
    let APP_URL_SCHEME = "de.wirewire.wirewire"  // Your app's URL scheme
    
    private var texts: [[String: Any]] = []
    private var files: [[String: Any]] = []

    override public func viewDidLoad() {
        super.viewDidLoad()
        
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            self.exit()
            return
        }

        Task {
            // Process attachments...
            // (See full implementation in issue examples)
            
            // Save to UserDefaults
            let shareData: [String: Any] = [
                "title": extensionItem.attributedTitle?.string ?? "",
                "texts": texts,
                "files": files
            ]
            
            let userDefaults = UserDefaults(suiteName: APP_GROUP_ID)
            userDefaults?.set(shareData, forKey: "share-target-data")
            userDefaults?.synchronize()
            
            // Open main app with your URL scheme
            let url = URL(string: "\(APP_URL_SCHEME)://share")!
            self.openURL(url)
        }
    }
    
    private func openURL(_ url: URL) {
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:]) { _ in
                    self.exit()
                }
                return
            }
            responder = responder?.next
        }

        exit()
    }

    private func exit() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    // ... rest of implementation
}
