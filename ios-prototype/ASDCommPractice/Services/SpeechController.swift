import AVFoundation
import Combine
import Foundation

/// `AVSpeechSynthesizer` で読み上げ、現在位置を UI で強調するための範囲を公開する。
final class SpeechController: NSObject, ObservableObject {
    @Published private(set) var highlightedUTF16Range: NSRange = .init(location: NSNotFound, length: 0)
    @Published private(set) var speakingFullText: String = ""
    @Published private(set) var isSpeaking = false

    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, buddy: VirtualBuddy) {
        stop()
        let utterance = AVSpeechUtterance(string: text)
        if let voice = AVSpeechSynthesisVoice(identifier: buddy.voiceIdentifier) {
            utterance.voice = voice
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: "ja-JP")
        }
        utterance.rate = buddy.voiceRate
        utterance.pitchMultiplier = buddy.voicePitch

        speakingFullText = text
        highlightedUTF16Range = .init(location: 0, length: 0)
        isSpeaking = true
        synthesizer.speak(utterance)
    }

    func stop() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        highlightedUTF16Range = .init(location: NSNotFound, length: 0)
    }
}

extension SpeechController: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        DispatchQueue.main.async {
            self.highlightedUTF16Range = characterRange
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async {
            self.isSpeaking = false
            self.highlightedUTF16Range = .init(location: NSNotFound, length: 0)
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async {
            self.isSpeaking = false
            self.highlightedUTF16Range = .init(location: NSNotFound, length: 0)
        }
    }
}
