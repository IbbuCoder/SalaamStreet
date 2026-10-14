import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled website (WebApp/) at app://salaamstreet/…
///
/// A real origin (not file://) gives the site working localStorage,
/// IndexedDB, hash routing, ES modules (pdf.js) and fetch(). Files are read
/// from the app bundle only; anything outside WebApp/ is refused.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "app"
    static let host = "salaamstreet"
    static let startURL = URL(string: "app://salaamstreet/index.html")!

    let root: URL
    private var stopped = Set<ObjectIdentifier>()
    private let queue = DispatchQueue(label: "com.salaamstreet.scheme", qos: .userInitiated)
    /// Paths the page asked for that are not in the bundle (checked by the tests).
    private(set) var missing: [String] = []

    init(root: URL = AppSchemeHandler.bundleRoot) {
        self.root = root.standardizedFileURL
    }

    static var bundleRoot: URL {
        Bundle.main.url(forResource: "WebApp", withExtension: nil) ?? Bundle.main.bundleURL.appendingPathComponent("WebApp")
    }

    /// The file for an app:// URL, or nil when it isn't part of the bundle.
    func fileURL(for url: URL) -> URL? {
        guard url.scheme == Self.scheme, url.host == Self.host else { return nil }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDir), !isDir.boolValue else { return nil }
        return file
    }

    static func mimeType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "wasm": return "application/wasm"
        case "woff2": return "font/woff2"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "pdf": return "application/pdf"
        case "mp3": return "audio/mpeg"
        default: return UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        let request = task.request
        queue.async { [weak self] in
            guard let self else { return }
            guard let url = request.url else { return }
            guard let file = self.fileURL(for: url) else {
                DispatchQueue.main.async {
                    self.missing.append(url.path)
                    self.respond(task, id: id, status: 404, headers: ["Content-Type": "text/plain"], body: Data("Not found".utf8), url: url)
                }
                return
            }
            let data: Data
            do { data = try Data(contentsOf: file, options: .mappedIfSafe) } catch {
                DispatchQueue.main.async { self.fail(task, id: id, error: error) }
                return
            }
            var headers = [
                "Content-Type": Self.mimeType(for: file),
                "Cache-Control": "no-cache",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
            ]
            var status = 200
            var body = data
            // Byte ranges (pdf.js reads the 18 MB Qur'an PDF in parts).
            if let range = request.value(forHTTPHeaderField: "Range"), let r = Self.parseRange(range, length: data.count) {
                status = 206
                body = data.subdata(in: r)
                headers["Content-Range"] = "bytes \(r.lowerBound)-\(r.upperBound - 1)/\(data.count)"
            }
            headers["Content-Length"] = String(body.count)
            DispatchQueue.main.async { self.respond(task, id: id, status: status, headers: headers, body: body, url: url) }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }

    /// "bytes=a-b", "bytes=a-" or "bytes=-n" → a half-open range inside the file.
    static func parseRange(_ header: String, length: Int) -> Range<Int>? {
        guard header.hasPrefix("bytes="), length > 0 else { return nil }
        let spec = header.dropFirst(6).split(separator: ",").first.map(String.init) ?? ""
        let parts = spec.split(separator: "-", omittingEmptySubsequences: false).map { String($0).trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2 else { return nil }
        var start: Int, end: Int
        if parts[0].isEmpty {
            guard let n = Int(parts[1]), n > 0 else { return nil }
            start = max(0, length - n); end = length - 1
        } else {
            guard let a = Int(parts[0]) else { return nil }
            start = a
            end = parts[1].isEmpty ? length - 1 : min(Int(parts[1]) ?? (length - 1), length - 1)
        }
        guard start <= end, start < length else { return nil }
        return start..<(end + 1)
    }

    private func respond(_ task: WKURLSchemeTask, id: ObjectIdentifier, status: Int, headers: [String: String], body: Data, url: URL) {
        guard !stopped.contains(id) else { stopped.remove(id); return }
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { return }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    private func fail(_ task: WKURLSchemeTask, id: ObjectIdentifier, error: Error) {
        guard !stopped.contains(id) else { stopped.remove(id); return }
        task.didFailWithError(error)
    }
}
