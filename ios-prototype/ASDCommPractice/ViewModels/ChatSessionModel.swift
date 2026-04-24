import Foundation

@MainActor
final class ChatSessionModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText: String = ""
    @Published var isSending = false
    @Published var lastError: String?

    let buddy: VirtualBuddy
    let baseDateJST: String

    private let openAI = OpenAIChatClient()
    private let gemini = GeminiChatClient()

    @Published var llmProvider: LLMProvider = .openAI

    init(buddy: VirtualBuddy, baseDateJST: String = "2026-04-19") {
        self.buddy = buddy
        self.baseDateJST = baseDateJST
    }

    private func client(for provider: LLMProvider) -> ChatLLMClient {
        switch provider {
        case .openAI: return openAI
        case .gemini: return gemini
        }
    }

    func send() async {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        lastError = nil
        messages.append(ChatMessage(isUser: true, text: trimmed))
        inputText = ""
        isSending = true
        defer { isSending = false }

        let system = SystemPromptBuilder.systemPrompt(for: buddy, baseDateJST: baseDateJST)

        do {
            let reply = try await client(for: llmProvider).complete(systemPrompt: system, userMessage: trimmed)
            messages.append(ChatMessage(isUser: false, text: reply))
        } catch {
            lastError = error.localizedDescription
        }
    }
}
