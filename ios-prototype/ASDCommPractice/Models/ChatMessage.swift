import Foundation

struct ChatMessage: Identifiable, Hashable {
    let id: UUID
    let isUser: Bool
    let text: String

    init(id: UUID = UUID(), isUser: Bool, text: String) {
        self.id = id
        self.isUser = isUser
        self.text = text
    }
}
