import SwiftUI

struct SituationSelectView: View {
    @ObservedObject var library: BuddyLibrary

    @State private var role: BuddyRole = .elementary6
    @State private var gender: Gender = .male

    private var selectedBuddy: VirtualBuddy? {
        library.buddy(role: role, gender: gender)
    }

    var body: some View {
        Form {
            Section {
                Picker("相手の立場", selection: $role) {
                    ForEach(BuddyRole.allCases) { r in
                        Text(r.rawValue).tag(r)
                    }
                }
                Picker("性別", selection: $gender) {
                    ForEach(Gender.allCases) { g in
                        Text(g.rawValue).tag(g)
                    }
                }
            } header: {
                Text("シチュエーション")
            }

            if let error = library.loadError {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }

            Section {
                if let buddy = selectedBuddy {
                    NavigationLink(value: buddy) {
                        Label("チャットをはじめる", systemImage: "message.and.waveform")
                            .font(.title3.weight(.semibold))
                    }
                } else {
                    Text("この組み合わせのキャラクターが見つかりません。characters.json を確認してください。")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("練習の設定")
        .navigationBarTitleDisplayMode(.large)
    }
}
