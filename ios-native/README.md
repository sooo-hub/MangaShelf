# MangaShelf (iOS Native / SwiftUI)

私用アプリとして開発している、漫画棚管理アプリのネイティブ iOS 版（SwiftUI + Firebase）。
配信予定はなく、Xcode / シミュレータでの動作確認のみを想定している。

Web版 (`origin/feat-rakuten-api` ブランチ、React + TS + Vite + Firebase) と同じデータモデル・
Firestoreコレクション (`mangaShelf`) を共有し、同じFirebaseプロジェクトを使う想定。
認証は無く、起動後すぐに本棚一覧が表示される。

## 構成

- Xcode プロジェクトは [XcodeGen](https://github.com/yonaskolb/XcodeGen) で `project.yml` から生成している。
  `.xcodeproj` はリポジトリにコミット済みなので、`xcodegen` が無くても Xcode でそのまま開ける。
  `project.yml` を編集した場合は `xcodegen generate` で再生成すること（`brew install xcodegen`）。
- 依存パッケージは Swift Package Manager 経由で firebase-ios-sdk (FirebaseCore / FirebaseFirestore) を使用。
  認証は使わない (FirebaseAuth 依存なし)。
- Firestore のデータ構造:
  - `mangaShelf/{id}`: フラットな1コレクションに全ての漫画タイトルを保存する
    (`title`, `author`, `publisher`, `latestVolume`, `genre`, `status`, `type`("own"/"wish"),
    `ownedVolumes: [Int]`, `wishUsers: [String]`, `seriesName`, `parts`, `createdAt`/`updatedAt`(epochミリ秒))。
  - `addSnapshotListener` によるリアルタイム同期を `MangaRepository` に実装済み。
  - 詳細画面編集中に無関係な別ドキュメントの変更で上書きされないよう、対象ドキュメント自体の
    `updatedAt` が進んだ場合のみ画面へ反映する (`MangaDetailSyncLogic`)。
- 検索・最新刊確認は外部APIを利用する:
  - 漫画検索: AniList GraphQL API (`https://graphql.anilist.co`、認証不要) — `AniListService`
  - 最新刊確認: 楽天ブックスAPI (`RakutenBooksAPI`)。認証情報未設定・失敗時はAniListへ自動フォールバック。

## ディレクトリ

```
ios-native/
  GoogleService-Info.plist.sample   # 本物のFirebase plistのテンプレート（コミット対象）
  RakutenSecrets.plist.sample       # 楽天ブックスAPI認証情報のテンプレート（コミット対象）
  MangaShelf/
    project.yml                     # XcodeGenの設定（Source of Truth）
    MangaShelf.xcodeproj/           # xcodegen generate で生成（コミット済み）
    Sources/
      App/MangaShelfApp.swift
      Models/Manga.swift            # Manga, MangaCandidate, UserName, MangaType 等
      Services/
        FirebaseBootstrap.swift     # plistが無くてもクラッシュしない起動処理
        MangaRepository.swift       # `mangaShelf` フラットコレクションのCRUD+リアルタイム同期
        MangaDetailSyncLogic.swift  # 詳細画面の上書き判定ロジック(純粋関数)
        AniListService.swift        # AniList検索・最新刊フォールバック
        RakutenBooksAPI.swift       # 楽天ブックスAPIでの最新刊確認
        RakutenSecrets.swift        # Secrets.plist読み込み
        InputValidation.swift
      Views/
        RootView.swift, MangaShelfView.swift (メイン画面)
        AddMangaView.swift (追加シート), MangaDetailView.swift (詳細シート)
        BulkUpdateResultView.swift, Theme.swift
        Components/ (MangaCardView, SeriesGroupView, VolumeGridView, UserBadgesView,
                      CandidateRowView, ManualFormView)
    Resources/
      GoogleService-Info.plist      # 実ファイル。.gitignore対象、各自で配置する
      Secrets.plist                 # 実ファイル。.gitignore対象、楽天API認証情報
```

## 本物の Firebase プロジェクトへの差し替え手順

1. [Firebase Console](https://console.firebase.google.com/) で Web版と同じ `manga-shelf-sou` プロジェクトを使う
   (別プロジェクトを使う場合はFirestoreを有効化した上でそのプロジェクトのplistを使う)。
2. Firestore Database を有効化する（認証は不要）。
3. iOS アプリを追加する（Bundle ID: `com.mangashelf.app.MangaShelf`。`ios-native/MangaShelf/project.yml` の
   `PRODUCT_BUNDLE_IDENTIFIER` と一致させること）。
4. ダウンロードした本物の `GoogleService-Info.plist` を以下に配置する（同名で上書き）。
   ```
   ios-native/MangaShelf/Resources/GoogleService-Info.plist
   ```
   このファイルは `.gitignore` によりコミットされないので、2台目以降の端末やクリーンな clone では
   都度このステップを行う必要がある。
5. 楽天ブックスAPIを使う場合は `ios-native/RakutenSecrets.plist.sample` を参考に
   `ios-native/MangaShelf/Resources/Secrets.plist` を作成し、`RakutenApplicationID` / `RakutenAccessKey`
   を設定する（空のままでもAniListへのフォールバックのみで動作する）。
6. Xcode で `ios-native/MangaShelf/MangaShelf.xcodeproj` を開き、Signing & Capabilities で
   自分の Apple ID / Team を設定する（実機で動かす場合）。
7. Firestore のセキュリティルールを、Web版と同じ内容に揃えておくこと
   （認証なしでのアクセスを想定した設計のため、公開範囲に注意する）。

## ビルド確認

```bash
cd ios-native/MangaShelf
xcodegen generate
xcodebuild -scheme MangaShelf -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild test -scheme MangaShelf -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17'
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
ネットワーク到達性を検証しないため、アプリはクラッシュせず本棚一覧画面（認証なし）まで起動する
（実際に Firestore への通信を伴う操作はエラーになる想定。コンソールに
`Permission denied` 等のログが出るが、アプリ自体はクラッシュしない）。
