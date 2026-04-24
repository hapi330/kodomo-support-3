import Foundation

enum Gender: String, CaseIterable, Identifiable, Codable {
    case male = "男"
    case female = "女"

    var id: String { rawValue }
}
