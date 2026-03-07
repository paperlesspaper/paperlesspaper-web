import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    let APP_GROUP_ID = "group.de.wirewire.wirewire.shareextension"
    let APP_URL_SCHEME = "de.wirewire.wirewire"

    private var texts: [String] = []
    private var files: [[String: Any]] = []

    override public func viewDidLoad() {
        super.viewDidLoad()
        
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            self.exit()
            return
        }

        processAttachments(attachments) { [weak self] in
            guard let self = self else { return }

            let shareData: [String: Any] = [
                "title": extensionItem.attributedTitle?.string ?? "",
                "texts": self.texts,
                "files": self.files
            ]

            let userDefaults = UserDefaults(suiteName: self.APP_GROUP_ID)
            userDefaults?.set(shareData, forKey: "share-target-data")
            userDefaults?.synchronize()

            let url = URL(string: "\(self.APP_URL_SCHEME)://share")!
            self.openURL(url)
        }
    }

    private func processAttachments(_ attachments: [NSItemProvider], completion: @escaping () -> Void) {
        let dispatchGroup = DispatchGroup()

        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                dispatchGroup.enter()
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                    defer { dispatchGroup.leave() }
                    guard let self = self else { return }

                    if let url = item as? URL {
                        self.texts.append(url.absoluteString)
                    } else if let text = item as? String {
                        self.texts.append(text)
                    }
                }
                continue
            }

            if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                dispatchGroup.enter()
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                    defer { dispatchGroup.leave() }
                    guard let self = self else { return }

                    if let text = item as? String {
                        self.texts.append(text)
                    }
                }
                continue
            }

            if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                dispatchGroup.enter()
                attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] item, _ in
                    defer { dispatchGroup.leave() }
                    self?.appendFile(from: item, fallbackMimeType: "image/*")
                }
                continue
            }

            if attachment.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                dispatchGroup.enter()
                attachment.loadItem(forTypeIdentifier: UTType.movie.identifier, options: nil) { [weak self] item, _ in
                    defer { dispatchGroup.leave() }
                    self?.appendFile(from: item, fallbackMimeType: "video/*")
                }
                continue
            }

            if attachment.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
                dispatchGroup.enter()
                attachment.loadItem(forTypeIdentifier: UTType.data.identifier, options: nil) { [weak self] item, _ in
                    defer { dispatchGroup.leave() }
                    self?.appendFile(from: item, fallbackMimeType: "application/octet-stream")
                }
            }
        }

        dispatchGroup.notify(queue: .main) {
            completion()
        }
    }

    private func appendFile(from item: NSSecureCoding?, fallbackMimeType: String) {
        guard let url = item as? URL else {
            return
        }

        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? fallbackMimeType
        let fileData: [String: Any] = [
            "uri": url.absoluteString,
            "name": url.lastPathComponent,
            "mimeType": mimeType
        ]
        files.append(fileData)
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
