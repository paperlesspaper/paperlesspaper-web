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
                    self?.appendImageFile(from: item)
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

        guard let sharedUrl = copyFileToSharedContainer(from: url) else {
            return
        }

        let mimeType = UTType(filenameExtension: sharedUrl.pathExtension)?.preferredMIMEType ?? fallbackMimeType
        let fileData: [String: Any] = [
            "uri": sharedUrl.absoluteString,
            "name": sharedUrl.lastPathComponent,
            "mimeType": mimeType
        ]
        files.append(fileData)
    }

    private func appendImageFile(from item: NSSecureCoding?) {
        if let image = item as? UIImage {
            writeImageToSharedContainer(image, baseName: "shared-image")
            return
        }

        if let url = item as? URL {
            let baseName = url.deletingPathExtension().lastPathComponent

            if let image = imageFromUrl(url) {
                writeImageToSharedContainer(image, baseName: baseName)
                return
            }

            if let sharedUrl = copyFileToSharedContainer(from: url) {
                let mimeType = UTType(filenameExtension: sharedUrl.pathExtension)?.preferredMIMEType ?? "image/*"
                let fileData: [String: Any] = [
                    "uri": sharedUrl.absoluteString,
                    "name": sharedUrl.lastPathComponent,
                    "mimeType": mimeType
                ]
                files.append(fileData)
            }
        }
    }

    private func writeImageToSharedContainer(_ image: UIImage, baseName: String) {
        guard let data = image.pngData(),
              let sharedDirectory = sharedFilesDirectory() else {
            return
        }

        let filename = "\(sanitizedFilename(baseName))-\(UUID().uuidString).png"
        let destination = sharedDirectory.appendingPathComponent(filename)

        do {
            try data.write(to: destination, options: .atomic)
            files.append([
                "uri": destination.absoluteString,
                "name": filename,
                "mimeType": "image/png"
            ])
        } catch {
            NSLog("ShareTarget: Failed to write shared image: \(error.localizedDescription)")
        }
    }

    private func copyFileToSharedContainer(from url: URL) -> URL? {
        guard let sharedDirectory = sharedFilesDirectory() else {
            return nil
        }

        let didAccessSecurityScopedResource = url.startAccessingSecurityScopedResource()
        defer {
            if didAccessSecurityScopedResource {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let originalExtension = url.pathExtension.isEmpty ? "dat" : url.pathExtension
        let originalBaseName = url.deletingPathExtension().lastPathComponent
        let filename = "\(sanitizedFilename(originalBaseName))-\(UUID().uuidString).\(originalExtension)"
        let destination = sharedDirectory.appendingPathComponent(filename)

        do {
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.copyItem(at: url, to: destination)
            return destination
        } catch {
            NSLog("ShareTarget: Failed to copy shared file: \(error.localizedDescription)")
            return nil
        }
    }

    private func imageFromUrl(_ url: URL) -> UIImage? {
        let didAccessSecurityScopedResource = url.startAccessingSecurityScopedResource()
        defer {
            if didAccessSecurityScopedResource {
                url.stopAccessingSecurityScopedResource()
            }
        }

        return UIImage(contentsOfFile: url.path)
    }

    private func sharedFilesDirectory() -> URL? {
        guard let containerUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: APP_GROUP_ID) else {
            return nil
        }

        let directory = containerUrl.appendingPathComponent("SharedFiles", isDirectory: true)

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
            return directory
        } catch {
            NSLog("ShareTarget: Failed to create shared files directory: \(error.localizedDescription)")
            return nil
        }
    }

    private func sanitizedFilename(_ filename: String) -> String {
        let allowedCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let sanitized = filename.unicodeScalars.map { scalar in
            allowedCharacters.contains(scalar) ? Character(scalar) : "-"
        }

        let result = String(sanitized).trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return result.isEmpty ? "shared-file" : result
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
