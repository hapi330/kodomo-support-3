import SwiftUI
import UIKit

/// `AVSpeechSynthesizer` の UTF-16 `NSRange` と一致させて読み上げ位置を強調する。
struct HighlightedUtteranceText: View {
    let fullText: String
    let utf16Range: NSRange

    var body: some View {
        let mas = NSMutableAttributedString(string: fullText)
        if utf16Range.location != NSNotFound,
           utf16Range.length > 0,
           utf16Range.location + utf16Range.length <= (fullText as NSString).length {
            mas.addAttribute(.backgroundColor, value: UIColor.systemYellow.withAlphaComponent(0.42), range: utf16Range)
        }
        return Text(AttributedString(mas))
            .font(.title3.weight(.medium))
            .foregroundStyle(Color.primary)
            .multilineTextAlignment(.leading)
    }
}
