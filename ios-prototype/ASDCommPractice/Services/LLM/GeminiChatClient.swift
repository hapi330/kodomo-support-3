import Foundation

/// Google Gemini API（generateContent）の雛形。`GEMINI_API_KEY` を Info.plist または環境変数で渡す想定。
final class GeminiChatClient: ChatLLMClient {
    private let apiKey: String?
    private let session: URLSession
    private let model: String

    init(
        apiKey: String? = GeminiChatClient.readAPIKey(),
        session: URLSession = .shared,
        model: String = "gemini-2.0-flash"
    ) {
        self.apiKey = apiKey
        self.session = session
        self.model = model
    }

    static func readAPIKey() -> String? {
        if let key = Bundle.main.object(forInfoDictionaryKey: "GEMINI_API_KEY") as? String, !key.isEmpty {
            return key
        }
        if let key = ProcessInfo.processInfo.environment["GEMINI_API_KEY"], !key.isEmpty {
            return key
        }
        return nil
    }

    func complete(systemPrompt: String, userMessage: String) async throws -> String {
        guard let apiKey else {
            throw ChatLLMError.missingAPIKey("GEMINI_API_KEY が未設定です。Xcode の Scheme 環境変数か Info.plist に設定してください。")
        }

        var components = URLComponents(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!
        components.queryItems = [URLQueryItem(name: "key", value: apiKey)]
        guard let url = components.url else {
            throw ChatLLMError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "contents": [
                [
                    "role": "user",
                    "parts": [["text": "\(systemPrompt)\n\n---\n\n\(userMessage)"]],
                ],
            ],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ChatLLMError.invalidResponse
        }
        guard (200 ... 299).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8)
            throw ChatLLMError.httpStatus(http.statusCode, text)
        }

        let decoded = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let candidates = decoded?["candidates"] as? [[String: Any]]
        let content = candidates?.first?["content"] as? [String: Any]
        let parts = content?["parts"] as? [[String: Any]]
        let text = parts?.first?["text"] as? String
        guard let text, !text.isEmpty else {
            throw ChatLLMError.invalidResponse
        }
        return text
    }
}
