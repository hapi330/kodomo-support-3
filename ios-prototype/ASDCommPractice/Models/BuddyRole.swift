import Foundation

/// 相手の立場（シチュエーション選択用）
enum BuddyRole: String, CaseIterable, Identifiable, Codable {
    case elementary6 = "小6"
    case junior1 = "中1"
    case teacher = "先生"
    case parent = "父兄"

    var id: String { rawValue }
}
