import Foundation

struct VirtualBuddy: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let role: String
    let gender: Gender
    let visualDescription: String
    let toneDescription: String
    /// 例: `com.apple.ttsbundle.Kyoko-compact`（端末にインストール済みの声に合わせて変更）
    let voiceIdentifier: String
    let voiceRate: Float
    let voicePitch: Float
    /// AsyncImage 用。未設定なら色付きプレースホルダー
    let imageURLString: String?

    init(
        id: String,
        name: String,
        role: String,
        gender: Gender,
        visualDescription: String,
        toneDescription: String,
        voiceIdentifier: String,
        voiceRate: Float,
        voicePitch: Float,
        imageURLString: String? = nil
    ) {
        self.id = id
        self.name = name
        self.role = role
        self.gender = gender
        self.visualDescription = visualDescription
        self.toneDescription = toneDescription
        self.voiceIdentifier = voiceIdentifier
        self.voiceRate = voiceRate
        self.voicePitch = voicePitch
        self.imageURLString = imageURLString
    }
}
