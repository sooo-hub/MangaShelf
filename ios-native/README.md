# MangaShelf (iOS Native / SwiftUI)

私用アプリとして開発している、漫画棚管理アプリのネイティブ iOS 版（SwiftUI + Firebase）。
配信予定はなく、Xcode / シミュレータでの動作確認のみを想定している。

リポジトリ内の `src/` (React Native / Expo) とは無関係の、独立した Xcode プロジェクト。

## 構成

- Xcode プロジェクトは [XcodeGen](https://github.com/yonaskolb/XcodeGen) で `project.yml` から生成している。
  `.xcodeproj` はリポジトリにコミット済みなので、`xcodegen` が無くても Xcode でそのまま開ける。
  `project.yml` を編集した場合は `xcodegen generate` で再生成すること（`brew install xcodegen`）。
- 依存パッケージは Swift Package Manager 経由で firebase-ios-sdk (FirebaseCore / FirebaseAuth / FirebaseFirestore) を使用。
- 認証はメール/パスワード認証（2端末で同じデータを共有するため、匿名認証は不採用）。
- Firestore のデータ構造:
  - `shelves/{shelfId}`: 本棚 (`name`, `createdAt`)
  - `shelves/{shelfId}/mangas/{mangaId}`: 漫画タイトル (`title`, `ownedVolumes: [Int]`, `totalVolumes: Int?`, `memo`, `updatedAt`)
  - `addSnapshotListener` によるリアルタイム同期を `ShelfRepository` / `MangaRepository` に実装済み。

## ディレクトリ

```
ios-native/
  GoogleService-Info.plist.sample   # 本物のplistのテンプレート（コミット対象）
  MangaShelf/
    project.yml                     # XcodeGenの設定（Source of Truth）
    MangaShelf.xcodeproj/           # xcodegen generate で生成（コミット済み）
    Sources/
      App/MangaShelfApp.swift
      Models/ (Shelf.swift, Manga.swift)
      Services/ (FirebaseBootstrap.swift, AuthService.swift, ShelfRepository.swift, MangaRepository.swift)
      Views/ (RootView, LoginView, ShelfListView, MangaListView, MangaDetailView, AddMangaView)
    Resources/
      GoogleService-Info.plist      # 実ファイル。.gitignore対象、各自で配置する
```

## 本物の Firebase プロジェクトへの差し替え手順

1. [Firebase Console](https://console.firebase.google.com/) で新規プロジェクトを作成する。
2. Firestore Database と Authentication (Email/Password プロバイダ) を有効化する。
3. iOS アプリを追加する（Bundle ID: `com.mangashelf.app.MangaShelf`。`ios-native/MangaShelf/project.yml` の
   `PRODUCT_BUNDLE_IDENTIFIER` と一致させること）。
4. ダウンロードした本物の `GoogleService-Info.plist` を以下に配置する（同名で上書き）。
   ```
   ios-native/MangaShelf/Resources/GoogleService-Info.plist
   ```
   このファイルは `.gitignore` によりコミットされないので、2台目以降の端末やクリーンな clone では
   都度このステップを行う必要がある。
5. Xcode で `ios-native/MangaShelf/MangaShelf.xcodeproj` を開き、Signing & Capabilities で
   自分の Apple ID / Team を設定する（実機で動かす場合）。
6. Firestore のセキュリティルールを、少なくとも認証済みユーザーのみ読み書き可能な設定にしておく
   （現時点ではルール未設定のため、本番運用前に必ず設定すること）。

## ビルド確認（このタスクで実施済み）

```bash
cd ios-native/MangaShelf
xcodegen generate
xcodebuild -scheme MangaShelf -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

シミュレータでの起動確認:

```bash
xcrun simctl boot "iPhone 17"
xcrun simctl install <UDID> \
  ~/Library/Developer/Xcode/DerivedData/MangaShelf-*/Build/Products/Debug-iphonesimulator/MangaShelf.app
xcrun simctl launch <UDID> com.mangashelf.app.MangaShelf
```

`GoogleService-Info.plist` がダミー値のままでも `FirebaseBootstrap.configureIfNeeded()` が
plist の存在チェックのみ行い、`FirebaseApp.configure()` 自体は plist の値をパースするだけで
ネットワーク到達性を検証しないため、アプリはクラッシュせずログイン画面まで起動する
（実際に Firebase Auth/Firestore への通信を伴う操作はエラーになる想定）。
