import SwiftUI
import UIKit

struct ChatView: View {
    @StateObject private var session: ChatSessionModel
    @StateObject private var speech = SpeechController()

    init(buddy: VirtualBuddy) {
        _session = StateObject(wrappedValue: ChatSessionModel(buddy: buddy))
    }

    var body: some View {
        VStack(spacing: 0) {
            characterHeader(session.buddy)

            Divider().background(Color.primary.opacity(0.25))

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ForEach(session.messages) { message in
                            messageRow(message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: session.messages.count) { _, _ in
                    if let last = session.messages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            if session.isSending {
                ProgressView("考え中…")
                    .padding(.vertical, 8)
            }

            composer
        }
        .background(Color(UIColor.systemBackground))
        .navigationTitle(session.buddy.name)
        .navigationBarTitleDisplayMode(.inline)
        .alert("エラー", isPresented: Binding(
            get: { session.lastError != nil },
            set: { if !$0 { session.lastError = nil } }
        )) {
            Button("OK", role: .cancel) { session.lastError = nil }
        } message: {
            Text(session.lastError ?? "")
        }
        .onChange(of: session.messages) { _, newValue in
            guard let last = newValue.last, !last.isUser else { return }
            speech.speak(last.text, buddy: session.buddy)
        }
        .onDisappear {
            speech.stop()
        }
    }

    @ViewBuilder
    private func characterHeader(_ buddy: VirtualBuddy) -> some View {
        HStack(alignment: .center, spacing: 16) {
            buddyAvatar(buddy)
                .frame(width: 88, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.2), lineWidth: 2)
                )

            VStack(alignment: .leading, spacing: 6) {
                Text(buddy.name)
                    .font(.title2.weight(.bold))
                Text("\(buddy.role)・\(buddy.gender.rawValue)")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Picker("AI", selection: $session.llmProvider) {
                    ForEach(LLMProvider.allCases) { p in
                        Text(p.displayName).tag(p)
                    }
                }
                .pickerStyle(.segmented)
            }
            Spacer(minLength: 0)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
    }

    @ViewBuilder
    private func buddyAvatar(_ buddy: VirtualBuddy) -> some View {
        if let urlString = buddy.imageURLString, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    placeholderColor(for: buddy.id)
                @unknown default:
                    placeholderColor(for: buddy.id)
                }
            }
        } else {
            placeholderColor(for: buddy.id)
        }
    }

    private func placeholderColor(for id: String) -> some View {
        let hue = Double(abs(id.hashValue % 360)) / 360.0
        return LinearGradient(
            colors: [Color(hue: hue, saturation: 0.45, brightness: 0.92), Color(hue: hue, saturation: 0.55, brightness: 0.78)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay {
            Image(systemName: "person.fill")
                .font(.system(size: 36, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
        }
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        HStack(alignment: .bottom) {
            if message.isUser { Spacer(minLength: 40) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 8) {
                if message.isUser {
                    Text(message.text)
                        .font(.title3)
                        .padding(14)
                        .background(Color.accentColor.opacity(0.22))
                        .foregroundStyle(Color.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        if speech.isSpeaking, speech.speakingFullText == message.text {
                            HighlightedUtteranceText(fullText: message.text, utf16Range: speech.highlightedUTF16Range)
                        } else {
                            Text(message.text)
                                .font(.title3)
                                .foregroundStyle(Color.primary)
                                .multilineTextAlignment(.leading)
                        }

                        HStack(spacing: 12) {
                            Button {
                                speech.speak(message.text, buddy: session.buddy)
                            } label: {
                                Label("もう一度読む", systemImage: "speaker.wave.2.fill")
                            }
                            .buttonStyle(.bordered)

                            if speech.isSpeaking && speech.speakingFullText == message.text {
                                Button("停止", role: .destructive) {
                                    speech.stop()
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                    .padding(14)
                    .background(Color(UIColor.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
                    )
                }
            }

            if !message.isUser { Spacer(minLength: 40) }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 12) {
            TextField("メッセージを入力", text: $session.inputText, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .font(.title3)
                .lineLimit(1 ... 5)

            Button {
                Task { await session.send() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 36))
                    .symbolRenderingMode(.hierarchical)
            }
            .disabled(session.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || session.isSending)
            .accessibilityLabel("送信")
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .overlay(alignment: .top) {
            Divider().background(Color.primary.opacity(0.15))
        }
    }
}
