import Foundation

enum LLMProvider: String, CaseIterable, Identifiable {
    case openAI
    case gemini

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .openAI: return "OpenAI"
        case .gemini: return "Google Gemini"
        }
    }
}

protocol ChatLLMClient: AnyObject {
    func complete(systemPrompt: String, userMessage: String) async throws -> String
}

enum ChatLLMError: LocalizedError {
    case missingAPIKey(String)
    case invalidResponse
    case httpStatus(Int, String?)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey(let detail):
            return detail
        case .invalidResponse:
            return "API の応答を解釈できませんでした。"
        case .httpStatus(let code, let body):
            if let body, !body.isEmpty { return "HTTP \(code): \(body)" }
            return "HTTP \(code)"
        }
    }
}
