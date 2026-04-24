import Foundation

/// OpenAI Chat Completions API の雛形。`OPENAI_API_KEY` を Info.plist または環境変数で渡す想定。
final class OpenAIChatClient: ChatLLMClient {
    private let apiKey: String?
    private let session: URLSession
    private let model: String

    init(
        apiKey: String? = OpenAIChatClient.readAPIKey(),
        session: URLSession = .shared,
        model: String = "gpt-4o-mini"
    ) {
        self.apiKey = apiKey
        self.session = session
        self.model = model
    }

    static func readAPIKey() -> String? {
        if let key = Bundle.main.object(forInfoDictionaryKey: "OPENAI_API_KEY") as? String, !key.isEmpty {
            return key
        }
        if let key = ProcessInfo.processInfo.environment["OPENAI_API_KEY"], !key.isEmpty {
            return key
        }
        return nil
    }

    func complete(systemPrompt: String, userMessage: String) async throws -> String {
        guard let apiKey else {
            throw ChatLLMError.missingAPIKey("OPENAI_API_KEY が未設定です。Xcode の Scheme 環境変数か Info.plist に設定してください。")
        }

        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userMessage],
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
        let choices = decoded?["choices"] as? [[String: Any]]
        let message = choices?.first?["message"] as? [String: Any]
        let content = message?["content"] as? String
        guard let content, !content.isEmpty else {
            throw ChatLLMError.invalidResponse
        }
        return content
    }
}
