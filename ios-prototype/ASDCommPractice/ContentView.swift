import SwiftUI

struct ContentView: View {
    @StateObject private var library = BuddyLibrary()

    var body: some View {
        NavigationStack {
            SituationSelectView(library: library)
                .navigationDestination(for: VirtualBuddy.self) { buddy in
                    ChatView(buddy: buddy)
                }
        }
        .tint(.accentColor)
    }
}

#Preview {
    ContentView()
}
