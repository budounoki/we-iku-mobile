/**
 * GuideScreen — 使い方ガイド（取扱説明書）
 *
 * 産前産後ケアホテル ぶどうの木 提供の「We育 使い方ガイド」PDF（2026-10）を
 * アプリ内に収録したもの。章ごとの折りたたみ（アコーディオン）で、最初は全章
 * 閉じた状態＝目次として表示され、タップで中身が開く。
 * 設定 →「使い方ガイド」から開く（旧「よくある質問」を置き換え）。
 */
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { palette, fonts, radius } from '../theme/tokens';
import { Card, Text } from '../theme/ui';
import { useTheme } from '../contexts/ThemeContext';

// ── 配色 ───────────────────────────────────────────────────────────────────
const PURPLE = '#7C3AED';
const PURPLE_DEEP = '#6D28D9';
const PURPLE_SOFT = '#EDE9FE';
const CREAM = '#FBF3E8';
const PINK_SOFT = '#FDECEF';
const AMBER_SOFT = '#FEF6E0';
const INK = '#3F3A4A';
const SUBINK = '#8A8398';

// ── コンテンツのブロック型 ──────────────────────────────────────────────────
type Feat = { icon: string; title: string; desc: string; isNew?: boolean };
type Block =
  | { k: 'para'; text: string; isNew?: boolean }
  | { k: 'sub'; text: string }
  | { k: 'feat'; items: Feat[] }
  | { k: 'steps'; items: { title: string; desc: string }[] }
  | { k: 'table'; rows: [string, string][] }
  | { k: 'tip'; icon: string; text: string }
  | { k: 'chips'; items: string[] }
  | { k: 'qa'; items: { q: string; a: string }[] };
type Chapter = { n: number; title: string; subtitle: string; blocks: Block[] };

const LEAD =
  '0〜6歳の育児を、ふたりでシェアするアプリです。だれかひとりが抱えこまなくていいように。毎日の「やったよ」が、ちゃんとパートナーに届くように。';
const INTRO_TITLE = 'はじめに、ふたりへ';
const INTRO_BODY =
  '授乳、おむつ、寝かしつけ。夜中の抱っこや、名前のつかない小さな家事。育児は、見えないところで続いています。\n\n' +
  'We育は、その一つひとつを記録して、ふたりで見える形にするアプリです。記録はリアルタイムでパートナーに届き、がんばった分はポイントになって、ご褒美と交換できます。完璧に記録しなくても大丈夫。できるときに、できる分だけ使ってください。\n\n' +
  '産前産後ケアホテル ぶどうの木';

const CHAPTERS: Chapter[] = [
  {
    n: 1, title: 'We育でできること', subtitle: 'ふたりで育児をシェアするための7つのしくみ',
    blocks: [
      { k: 'feat', items: [
        { icon: '🔄', title: 'リアルタイム共有', desc: '授乳・おむつ・ねんねを記録すると、すぐにパートナーのアプリにも反映されます。' },
        { icon: '📊', title: '育児の見える化', desc: 'どちらがどれくらい育児をしているか、グラフで確認できます。' },
        { icon: '🎁', title: 'ご褒美と交換', desc: '記録するとポイントがたまり、「ひとりタイム券」などのご褒美と交換できます。' },
        { icon: '🌱', title: '成長をまとめて管理', desc: '身長・体重、予防接種、離乳食の記録をひとつのアプリで管理できます。' },
        { icon: '🌙', title: 'ねんトレのサポート', desc: 'ねんね卒業の練習を、ふたりで同じ手順で進められます。' },
        { icon: '📖', title: '月ごとの振り返り', desc: '食事やはじめてできたことを、月ごとに一覧で見返せます。', isNew: true },
        { icon: '🌗', title: 'ダークモード', desc: 'ライト／ダーク／自動から選べます。夜中の授乳でもまぶしくありません。' },
      ] },
    ],
  },
  {
    n: 2, title: 'はじめかた', subtitle: '最初に一度だけ。4ステップ、数分で終わります',
    blocks: [
      { k: 'steps', items: [
        { title: 'ログイン', desc: 'LINE・Google・Appleのアカウントでログインできます。アカウントを使わずに、ゲストとして始めることもできます。' },
        { title: 'ロールを選ぶ', desc: '「ママ」か「パパ」をタップします。呼び方はあとから「かあちゃん」「おとうさん」などに変えられます。' },
        { title: '家族IDでつながる', desc: 'はじめに登録する人：「新規作成」をタップすると、6桁の家族IDが発行されます。このIDをパートナーに送ってください。\nパートナー：受け取った6桁のIDを入力して「参加」をタップします。' },
        { title: 'お子さんを登録', desc: '名前・生年月日・性別を入力します。月齢に合わせて、画面や記録ボタンが自動で切り替わります。最後に短いチュートリアルが出ます（スキップもできます）。' },
      ] },
      { k: 'tip', icon: '🍇', text: '家族IDが同じなら、ふたりの記録は自動で同期されます。ここがつながれば準備は完了です。' },
    ],
  },
  {
    n: 3, title: 'ホーム画面', subtitle: 'アプリを開くと最初に表示される画面です',
    blocks: [
      { k: 'feat', items: [
        { icon: '👆', title: '記録ボタン', desc: '画面中央のボタンから、よく使う記録をワンタップで入力できます。詳しくは4章へ。' },
        { icon: '🍼', title: 'ミルクのまとめ', desc: '乳児期は、母乳の回数（ふたりの合計）と「粉120ml / 搾80ml」のような内訳をひと目で確認できます。' },
        { icon: '💬', title: 'WeBoard（ウィーボード）', desc: '画面下の掲示板です。「今日もお疲れさま」「あとよろしく」など、パートナーにひとことを残せます。' },
        { icon: '💉', title: 'そろそろ予防接種', desc: '接種時期が近づくと、ホームにお知らせカードが出ます。10章で設定できます。' },
      ] },
      { k: 'sub', text: '「だれがやった？」を選ぶ' },
      { k: 'para', text: '全17種類の記録画面で、担当者（ママ／パパ）を選べます。ふたり同時に選べば「ふたりでやった」記録になり、両方の実績としてカウントされます。' },
      { k: 'para', text: 'ママがパパの分をまとめて記録するときも、担当者をパパにしておけば、ポイントはパパに入ります。' },
    ],
  },
  {
    n: 4, title: '記録ボタン（クイックログ）', subtitle: '月齢に合わせて、必要なボタンだけが並びます',
    blocks: [
      { k: 'feat', items: [
        { icon: '🔄', title: '月齢で自動切替', desc: 'お子さんの月齢に応じて、ボタンが4つのフェーズで自動的に入れ替わります。' },
        { icon: '⚙️', title: 'ON / OFF', desc: '設定 → お子さんのプロフィール →「ボタンカスタマイズ」で、1つずつ表示を切り替えられます。' },
        { icon: '➕', title: 'オリジナルボタン', desc: 'ホーム右上「並び替え」→「＋」で、名前・アイコン・色を選んで最大10個まで追加できます。' },
      ] },
      { k: 'sub', text: 'フェーズ 0 ｜ 乳児期 0〜11ヶ月' },
      { k: 'table', rows: [
        ['ミルク', '母乳・ミルクの種別、量、左右の時間。授乳タイマーで計測でき、一時停止もできます'],
        ['搾乳', 'タイマーまたは手入力で時間を記録。量は30〜300ml（5ml刻み）'],
        ['おむつ', 'おしっこ・うんちをワンタップ。担当者に「その他」も選べます'],
        ['ねんね', '入眠・起床の時刻、寝かしつけの方法・かかった時間・寝た場所'],
        ['離乳食', '食材ごとの食べ具合（7段階）と、食事メモ'],
        ['おふろ・抱っこ', '担当者（ふたり同時も可）。抱っこは開始〜終了時刻も'],
        ['あそび', '遊びの種類を複数選んで記録'],
        ['はじめて', 'はじめてできたこと'],
        ['おくすり・たいおん・通院', '薬の名前と量、体温、受診の内容'],
        ['ありがとう', 'パートナーへの感謝のメッセージ'],
      ] },
      { k: 'chips', items: ['おやつ', 'のみもの', '園の記録', 'はみがき', '保湿（初期は非表示）', '爪切り（初期は非表示）'] },
      { k: 'sub', text: 'フェーズ 1 ｜ 幼児前期 1〜2歳' },
      { k: 'chips', items: ['ごはん', 'ミルク', 'おやつ', 'トイレ', 'ねんね', 'ことば', 'おふろ', 'おむつ', 'できた', 'ありがとう', 'あそび', 'はじめて', '抱っこ', 'のみもの', '園の記録', 'はみがき', 'おくすり', 'たいおん', '通院'] },
      { k: 'sub', text: 'フェーズ 2 ｜ 幼児後期 2〜4歳' },
      { k: 'chips', items: ['ごはん', 'おやつ', 'トイレ', 'ねんね', 'しつけ', 'きょうみ', 'できた！', 'ありがとう', 'ミルク', 'おむつ', 'おふろ', '抱っこ', 'のみもの', '園の記録', 'はみがき', 'おくすり', 'たいおん', '通院'] },
      { k: 'sub', text: 'フェーズ 3 ｜ 就学準備期 4〜6歳' },
      { k: 'chips', items: ['ごはん', 'ねんね', '園の記録', 'しつけ', 'よてい', 'できた！', 'ありがとう', 'おやつ', 'のみもの', 'はみがき', 'おくすり', 'たいおん', '通院'] },
      { k: 'tip', icon: '💡', text: '爪切り・保湿のボタンは、はじめは非表示です。設定 → お子さんのプロフィール →「ボタンカスタマイズ」でONにすると、0〜6歳のどのフェーズでも使えます。記録すると10pt（深夜は20pt）がたまります。' },
      { k: 'sub', text: 'ミルク・搾乳' },
      { k: 'feat', items: [
        { icon: '⏱', title: '授乳タイマー', desc: '左／右をタップで計測スタート（ピンク表示）。一時停止するとグレーになり、止めていた時間は加算されません。「終了して記録」で、実際に授乳した時間が分単位で入ります。' },
        { icon: '⌨️', title: '時間は手入力でも', desc: '左右の時間は数字キーボードで直接入力できます。' },
        { icon: '✅', title: '「あげた」だけでもOK', desc: '時間を計り忘れても、0分のまま保存できます。「あげた事実」だけを残せます。' },
        { icon: '🔀', title: '搾乳はモードを選べる', desc: 'タイマー：左右をタップして計測。手入力：左右の時間を0〜120分で入力。あとからまとめて入れたいときに。' },
      ] },
      { k: 'sub', text: 'ねんね' },
      { k: 'para', text: '「抱っこで30分かかった」「添い乳で寝かせた」。夜中の大変な寝かしつけも、パートナーにきちんと伝わります。すべて任意なので、選ばずに「寝た」だけでも記録できます。' },
      { k: 'table', rows: [
        ['寝かしつけ方法', '抱っこ／抱っこひも／添い乳／添い寝／なし'],
        ['かかった時間', '5・10・15・20・30・45・60分'],
        ['寝た場所', '布団／抱っこ寝／抱っこひも寝／ベビーカー／チャイルドシート'],
      ] },
      { k: 'para', text: '選んだ内容は、タイムラインにバッジで表示されます（紫＝方法、水色＝場所）。パートナーへの通知にも「抱っこ・30分・抱っこ寝」の形で届きます。' },
      { k: 'sub', text: '過去のねんねをあとから入力' },
      { k: 'para', text: '「ねんね中」の画面で「過去のねんねを手入力」をタップすると、いま進行中のねんねを止めずに、別のねんねを追加できます。入力が終わると「ねんね中」画面に戻ります。' },
      { k: 'para', text: '昼寝中に昨夜の分を記録したいとき、上の子のねんねを追加したいとき、パートナーが寝かしつけた分をあとから入れたいときに便利です。' },
      { k: 'sub', text: '離乳食' },
      { k: 'para', text: '食材ごとに1行ずつ、食べ具合を記録します。食材名は手で入力するか、「チェックリストから選ぶ」で試したことのある食材から選べます。「＋ 食材を追加」でいくつでも足せて、右の × で削除できます。量を1つ以上選ぶと「記録する」が押せるようになります。' },
      { k: 'para', text: '食べ具合は7段階になりました。お子さんの食欲を、より細かく残せます。', isNew: true },
      { k: 'chips', items: ['イヤイヤ', '少し', '1/3', '半分', '2/3', '8割', '完食'] },
      { k: 'para', text: '食事メモ：「嬉しそうに食べた」「口を開けるまで時間がかかった」など、様子を自由に書けます。あとで読み返すと、その頃のことがよみがえる記録になります。' },
      { k: 'para', text: '自分で追加した食材は、食材チェックリストで長押しすると名前・カテゴリの編集や削除ができます。もともと入っている食材は「非表示にする／再表示する」のみです。' },
    ],
  },
  {
    n: 5, title: 'きろく（タイムライン）', subtitle: '1日の記録を時間順に見られます',
    blocks: [
      { k: 'feat', items: [
        { icon: '📅', title: '日付を移動', desc: '上の日付をタップするか、左右にスワイプします。' },
        { icon: '✏️', title: '直す・消す', desc: '記録をタップすると、時刻の変更や削除ができます。' },
        { icon: '📋', title: '中身まで見える', desc: '離乳食の食べ具合、あそび・はじめて・できた・ことば・おやつの内容、寝かしつけのバッジ、食事メモが表示されます。', isNew: true },
        { icon: '💬', title: 'やさしい言葉に', desc: '寝かしつけ方法の表示を、見返したときにほっこりできる言い回しにしました。', isNew: true },
      ] },
      { k: 'sub', text: '夜中に起きていた時間' },
      { k: 'para', text: '睡眠バーをタップ →「編集」で「夜中に起きていた時間（分）」を入力できます。夜泣きで30分起きていたら「30」。保存すると「実質睡眠時間」と「夜中起き −30分」が表示されます。' },
      { k: 'sub', text: '記録の分析' },
      { k: 'para', text: 'タイムライン上部の「分析」ボタンから開きます。' },
      { k: 'feat', items: [
        { icon: '📈', title: '今日のサマリー', desc: '睡眠時間・授乳回数・おしっこ・うんちを、昨日と比べた増減の矢印つきで表示します。' },
        { icon: '🌙', title: '睡眠分析', desc: '7日間のグラフと14日間のヒートマップで、よく眠れている時間帯（上位3つ）がわかります。1日あたりの平均で表示するようになりました。', isNew: true },
        { icon: '🍼', title: '授乳・おしっこ・うんち', desc: '7日間のグラフと、今日と7日前の比較表で1週間の変化を確認できます。' },
        { icon: '📊', title: 'ミルク量（ml）', desc: '7日間のミルク量をグラフにします。「最近よく飲むようになった」が数字でわかります。', isNew: true },
        { icon: '🗑', title: 'あの日を除外', desc: '体調不良や旅行の日を分析から外して、ふだんの傾向を見られます。', isNew: true },
      ] },
    ],
  },
  {
    n: 6, title: '振り返りと思い出PDF', subtitle: 'きろく画面右上の「振り返り」から',
    blocks: [
      { k: 'table', rows: [
        ['全部', '振り返りの対象になるすべての記録'],
        ['食事', '離乳食・ごはん・おやつ（食材・量つき、食事メモも）'],
        ['マイルストーン', 'はじめて・できた・ことば など'],
        ['園・予定', '園の連絡帳メモと、カレンダーに入れた家族の予定'],
      ] },
      { k: 'para', text: '日付ごとにまとめて表示され、月を切り替えられます。' },
      { k: 'sub', text: '3種類のPDF' },
      { k: 'feat', items: [
        { icon: '📖', title: '思い出PDF', desc: '振り返り → 右上の📖。表紙（名前・誕生日・月齢）、はじめて・できた・ことばの記録、月別の授乳・おむつ回数、パートナーへの「ありがとう」をまとめます。いつかお子さんに見せてあげてください。' },
        { icon: '🏥', title: '健康データPDF', desc: 'けんこう →「提出用データの書き出し」。病院や保育園に提出する用です。' },
        { icon: '🗓', title: '1週間レポートPDF', desc: 'きろく → 右上「PDF」。毎日の記録を1週間ごとにまとめます。' },
      ] },
      { k: 'tip', icon: '💡', text: 'PDFの書き出し（保存）は、We育の Web版（ブラウザ）でご利用いただけます。アプリでは記録や振り返りの内容を確認できます。' },
    ],
  },
  {
    n: 7, title: 'カレンダー', subtitle: '家族の予定と、成長の記録がならびます',
    blocks: [
      { k: 'sub', text: '予定を追加する' },
      { k: 'para', text: '右上の「予定を追加」から作成します。「チェック」で完了にすると、線が引かれて緑色になります。' },
      { k: 'table', rows: [
        ['タイトル', '例：1ヶ月健診、予防接種、保育園見学'],
        ['時間', '任意。空欄なら「--:--」と表示'],
        ['担当', 'パパ／ママ／未定'],
        ['メモ', '持ち物や注意点など'],
        ['アイコン・カラー', '16種類のアイコン、10色から選択'],
      ] },
      { k: 'tip', icon: '🍇', text: '記念日プリセット：「プリセット」タブから、お宮参り・生後100日・ハーフバースデーなど10種類の行事をワンタップで追加できます。日付・アイコン・色は自動で入ります。' },
      { k: 'sub', text: '記録から自動で入るもの' },
      { k: 'para', text: 'ことば・はじめて・しつけ・きょうみ・できた！・予防接種・症状と体温の記録は、その日のカレンダーに自動で表示されます。日付をタップすると、入力した内容も小さく表示されます。授乳・おむつ・ねんねなどの毎日のケアは、カレンダーではなくきろくで確認してください。' },
      { k: 'sub', text: 'ドットの色' },
      { k: 'table', rows: [
        ['● 紫', '未完了の予定、または記録あり'],
        ['● 緑', 'その日の予定がすべて完了'],
        ['● バラ色', '症状・体温の記録あり'],
      ] },
      { k: 'para', text: '上の「○年○月」をタップすると、月表示と週表示が切り替わります。' },
    ],
  },
  {
    n: 8, title: '名もなき育児（ダッシュボード）', subtitle: 'ふたりの育児バランスを確かめる画面です',
    blocks: [
      { k: 'feat', items: [
        { icon: '📊', title: '貢献グラフ', desc: 'ママ・パパそれぞれの記録数を円グラフとタスク別の棒グラフで表示します。どちらかが80%を超えると、バランスについてのメッセージが出ます。' },
        { icon: '🕐', title: '時給換算', desc: '記録した育児を「外注したらいくら？」で金額にします。毎日の積み重ねが数字で見えます。' },
        { icon: '🧺', title: '名もなき育児', desc: '洗濯、哺乳瓶洗いなど、記録に残りにくい家事も残せます。' },
      ] },
      { k: 'steps', items: [
        { title: '「名もなき育児を記録する」をタップ', desc: '' },
        { title: 'だれがやったかを選ぶ', desc: '上の欄で、ママ／パパ／その他 を選びます。' },
        { title: '項目のボタンをタップして完了', desc: '「最近の記録」に直近8件が時刻・担当者つきで表示されます。' },
      ] },
      { k: 'tip', icon: '💡', text: '「カスタム追加」で「保育園の準備」など、わが家の項目を最大10個まで作れます。アイコンも選べます。' },
    ],
  },
  {
    n: 9, title: 'ねんトレ（睡眠トレーニング）', subtitle: '赤ちゃんが自分でねんねする練習を、ふたりで',
    blocks: [
      { k: 'feat', items: [
        { icon: '✅', title: '環境チェックリスト', desc: '暗さ・温度・ホワイトノイズなど、寝室の環境を確認します。毎晩のルーティンの前にどうぞ。' },
        { icon: '🛁', title: 'ルーティンミッション', desc: 'お風呂 → 絵本 → 電気を消す、のように、ねんね前の流れを順番に記録します。すべて完了するとポイントが3倍になります。' },
        { icon: '⏱', title: '夜泣きタイマー', desc: '泣き始めてもすぐには行かず、少し待つためのタイマーです。待っている間、応援メッセージが表示されます。' },
      ] },
    ],
  },
  {
    n: 10, title: 'けんこう', subtitle: '成長・予防接種・体調・ママのからだ',
    blocks: [
      { k: 'feat', items: [
        { icon: '📈', title: '成長曲線', desc: '身長・体重を入れると、日本の標準成長曲線と並べて表示します。' },
        { icon: '💉', title: '予防接種スケジュール', desc: '日本の標準スケジュールを「現在・今後・完了」に分けて表示し、接種済みも記録できます。' },
        { icon: '🌡', title: '症状・体温', desc: '発熱・咳・発疹などと体温を記録します。カレンダーにバラ色のドットで反映されます。あとから編集・削除ができ、一覧に日付が表示されます。', isNew: true },
        { icon: '🏥', title: '受診サポート', desc: '記録した症状と37.5°C以上の体温を、新しい順に日時つきで一覧にします。診察のとき、この画面をそのまま見せられます。', isNew: true },
      ] },
      { k: 'sub', text: '予防接種リマインド' },
      { k: 'steps', items: [
        { title: '「予防接種リマインド」をオンにする', desc: '「設定」から切り替えます。' },
        { title: '何日前に知らせるかを選ぶ', desc: '3日前・7日前・14日前・30日前から選べます（はじめは7日前）。' },
        { title: '通知を許可する', desc: '許可を求められたら「許可」。許可しなくても、アプリ内のお知らせは表示されます。' },
      ] },
      { k: 'para', text: '時期が近づくと「もうすぐ○○の接種時期です」、時期になると「○○が接種時期です」、過ぎると「かかりつけ医にご相談ください」とお知らせします。ホームの「そろそろ予防接種」カードはふたりともに表示され、接種済みにすると自動で消えます。任意接種には「任意接種」と表示されます。' },
      { k: 'para', text: '前回の接種が遅れた場合は、必要な間隔をあけて次の時期を計算します。前の回が未接種のあいだは、次の回のお知らせは出ません。ロタワクチンは、ロタリックスかロタテックかを選んでからリマインドが始まります。' },
      { k: 'tip', icon: '⚠️', text: '表示される時期は、一般的なスケジュールをもとにした目安です。実際の接種時期は、自治体の案内やかかりつけ医の指示を必ず確認してください。' },
      { k: 'sub', text: '食材チェックリスト' },
      { k: 'para', text: '赤ちゃんに試した食材をカテゴリ別に管理します。離乳食の記録画面からも開けます。カスタム食材の追加、カテゴリ絞り込み、検索ができ、食べた日は空欄のままでも保存できます。' },
      { k: 'chips', items: ['未試（まだ食べていない）', 'OK（問題なく食べた）', '注意（反応あり・メモつき）'] },
      { k: 'sub', text: 'ママのからだ記録' },
      { k: 'para', text: '産後のママ自身の体調を、毎日残せます。' },
      { k: 'table', rows: [
        ['お通じ', 'あり／なし、コメント'],
        ['悪露', '状態を選択'],
        ['会陰の痛み・気分', 'それぞれ0〜4の5段階'],
        ['睡眠時間', '時間・分'],
        ['授乳トラブル', '乳首の痛み・乳腺炎など（複数選択）'],
        ['体重・むくみ', 'kg、あり／なし'],
        ['抱っこ', '抱っこした時間と担当者'],
      ] },
      { k: 'para', text: '上の日付をタップすると、過去の日に切り替えて入力できます（未来の日は選べません）。同じ日に何度か記録すると、最新の内容で上書きされます。' },
      { k: 'para', text: '自分のお薬を記録：お薬の名前（前に入れた名前が候補に出ます）、用量、メモを残せます。ボタンに「最後に飲んでから何時間」が表示されるので、飲み忘れや飲みすぎを防げます。' },
      { k: 'para', text: 'お薬の履歴を見る：ホーム → 健康・成長記録 → ママのからだ記録 →「お薬の履歴を見る」で、これまでの服薬を新しい順に確認できます。日時・薬の名前・服用量・メモが一覧で表示されます。', isNew: true },
    ],
  },
  {
    n: 11, title: 'ご褒美ショップ', subtitle: 'ためたポイントを、パートナーからのクーポンに',
    blocks: [
      { k: 'chips', items: ['☕ 1時間ひとりタイム券', '💆 マッサージお願い券', '🍜 好きなご飯リクエスト券'] },
      { k: 'steps', items: [
        { title: 'クーポンを選んで交換', desc: 'ご褒美ショップでクーポンを選び、ポイントと交換します。' },
        { title: 'パートナーに通知が届く', desc: '' },
        { title: '使いたいときに見せて使う', desc: '' },
      ] },
    ],
  },
  {
    n: 12, title: 'スキルツリー', subtitle: 'ふたりで育児をこなすと、スキルが解放されます',
    blocks: [
      { k: 'table', rows: [
        ['Lv.0', '基本的な育児スキルの習得'],
        ['Lv.1', '「夜間交代ローテーション」など、ふたりの連携スキル'],
        ['Lv.2', '「かかりつけ医レポートマスター」など、専門スキル'],
        ['Lv.3', '実際の育児に沿った上級スキル'],
      ] },
      { k: 'tip', icon: '🍇', text: 'レベルはお子さんの月齢に合わせて分かれています。パートナーの承認が必要なスキルもあるので、ふたりで確認し合いながら進めてください。' },
    ],
  },
  {
    n: 13, title: 'ポイントのしくみ', subtitle: '深夜の育児も、ちゃんと評価されます',
    blocks: [
      { k: 'table', rows: [
        ['10〜30 pt', 'ふだんの記録 1回'],
        ['30 pt', 'はじめて・マイルストーン'],
        ['＋10 pt', '深夜（0〜5時）の記録ボーナス'],
        ['×3', 'ねんトレのルーティンミッション完了'],
      ] },
      { k: 'sub', text: 'チームパワー' },
      { k: 'para', text: '「いま、ふたりでどれだけがんばっているか」を表す数字です。毎日こつこつ記録するほど高くなります。' },
      { k: 'tip', icon: '＝', text: '（累計ポイント ＋ ありがとうの数 × 5）÷ 生後日数' },
      { k: 'tip', icon: '🍇', text: 'ためたポイントはご褒美ショップでクーポンと交換できます。残高はご褒美ショップの上部に表示されます。' },
    ],
  },
  {
    n: 14, title: '設定', subtitle: 'わが家に合わせて、使いやすく',
    blocks: [
      { k: 'feat', items: [
        { icon: '👶', title: '家族・お子さん', desc: '名前・生年月日・性別・テーマカラーを変更できます。きょうだいを複数登録して切り替えられます。' },
        { icon: '🔗', title: '家族ID・招待', desc: '家族IDの確認と、パートナーへの招待コードの発行ができます。' },
        { icon: '🏷', title: '呼び方', desc: '「ママ」「パパ」を「かあちゃん」「おとうさん」などに変えられます。アプリ全体に反映されます。' },
        { icon: '🔔', title: '通知', desc: '記録のリマインダーや、パートナーからの通知をオン・オフできます。' },
        { icon: '🌗', title: '画面の明るさ', desc: 'ライト／ダーク／自動（夜18時〜朝6時はダーク）から選べます。' },
        { icon: '🧹', title: '表示設定', desc: '使わない機能（WeBoard、チーム育児スキル）をオフにして、ホームをすっきりできます。' },
        { icon: '📝', title: '名もなき育児の項目', desc: 'ダッシュボードで追加した項目の編集・削除はここから。' },
      ] },
      { k: 'sub', text: '授乳アラーム（乳児期のみ）' },
      { k: 'steps', items: [
        { title: '「授乳アラーム」のトグルをON', desc: '設定の「授乳アラーム」から切り替えます。' },
        { title: '通知を許可する', desc: 'はじめてのときは通知の許可を求められるので「許可」。' },
        { title: '何分前に知らせるかを選ぶ', desc: '5・10・15・20・30分前から選べます。' },
      ] },
      { k: 'para', text: '目標授乳間隔：「自動」（これまでの平均から計算）か、2〜6時間の固定を選べます。離乳食を食べた時刻も「最後の食事」として数えます。月齢が進んで間隔を延ばしたいときにどうぞ。変更しても過去の記録には影響しません。' },
    ],
  },
  {
    n: 15, title: 'よくある質問', subtitle: '困ったときは、まずここを',
    blocks: [
      { k: 'sub', text: 'はじめかた・共有' },
      { k: 'qa', items: [
        { q: 'ログインはどうするの？', a: 'LINE・Google・Appleのいずれかのアカウントでログインできます。アカウントを使わずに、ゲストとして使うこともできます。' },
        { q: 'パートナーの記録が反映されない', a: 'ふたりの家族IDが同じか確認してください。設定 → 家族ID で確認できます。' },
        { q: '記録ボタンが急に変わった', a: 'お子さんの月齢に合わせて自動で切り替わります。正常な動きです。使いたいボタンは「ボタンカスタマイズ」でONにできます。' },
      ] },
      { k: 'sub', text: '記録' },
      { k: 'qa', items: [
        { q: '記録を間違えた', a: 'タイムラインでその記録をタップすると、時刻の変更や削除ができます。' },
        { q: '授乳の時間を計り忘れた', a: '左右0分のままでも保存できます。「あげた事実」だけを残せます。' },
        { q: '昨日のねんねを入れ忘れた', a: 'ホームの「ねんね」をタップし、「過去のねんねを手入力」から入眠・起床時刻をさかのぼって入れられます。' },
        { q: '粉ミルクと搾乳の両方をあげた日は？', a: 'ホームに「粉Xml / 搾Yml」と内訳で表示されます。タイムラインでは母乳・搾乳・粉ミルク・混合を区別して表示します。' },
        { q: '搾乳タイマーが途中で消えた', a: 'アプリを閉じて開き直しても、経過時間は正しく計算し直されます。アラームを設定している場合は、画面に戻ったときに確認できます。' },
        { q: 'ねんね予想の時刻を過ぎてしまった', a: '「予想時刻が過ぎました。焦らず大丈夫です。」と表示されます。予想はあくまで目安。その日の体調やご機嫌でずれるのは自然なことです。' },
        { q: '非表示にした食材を戻したい', a: '食材チェックリストの「非表示の食材を見る」から再表示できます。' },
      ] },
      { k: 'sub', text: 'けんこう' },
      { k: 'qa', items: [
        { q: '発熱や嘔吐も記録できる？', a: 'できます。「けんこう」→「症状・体温の記録」から、症状とメモを残せます。カレンダーにはバラ色のドットで表示されます。' },
        { q: '病院で症状をうまく説明できるか不安', a: 'けんこう画面の「受診サポート」を開くと、症状と体温が日時つきで一覧になります。そのまま画面を見せてください。' },
        { q: 'ママのからだ記録を昨日の日付で入れたい', a: '記録画面のタイトル下にある日付をタップすると、過去の日に変えられます。未来の日は選べません。' },
      ] },
      { k: 'sub', text: 'ポイント・表示' },
      { k: 'qa', items: [
        { q: 'ポイントはどこで見られる？', a: 'ご褒美ショップの上部に、いまのポイント残高が表示されます。' },
        { q: 'ねんトレの担当者名が「パパ」「ママ」と違う', a: '設定で呼び方を変えている場合、ルーティンの担当者にもその呼び方が反映されます。' },
        { q: 'ダークモードはどこで設定する？', a: '設定 →「画面の明るさ」で、ライト・ダーク・自動から選べます。自動なら18時〜翌6時はダークになります。設定は次に開いたときもそのままです。ダークモードでは「次の授乳予測」なども見やすいピンク系の色で表示されます。' },
      ] },
    ],
  },
];

// ── ブロック描画 ────────────────────────────────────────────────────────────
function NewBadge() {
  return <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>;
}

function BlockView({ block }: { block: Block }) {
  switch (block.k) {
    case 'para':
      return (
        <Text style={styles.para}>
          {block.isNew ? <Text style={styles.inlineNew}>NEW </Text> : null}{block.text}
        </Text>
      );
    case 'sub':
      return (
        <View style={styles.subRow}>
          <View style={styles.subDot} />
          <Text style={styles.subText}>{block.text}</Text>
        </View>
      );
    case 'feat':
      return (
        <View style={styles.featWrap}>
          {block.items.map((f, i) => (
            <View key={i} style={styles.featCard}>
              <View style={styles.featHead}>
                <Text style={styles.featIcon}>{f.icon}</Text>
                <Text style={styles.featTitle}>{f.title}</Text>
                {f.isNew && <NewBadge />}
              </View>
              <Text style={styles.featDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      );
    case 'steps':
      return (
        <View>
          {block.items.map((s, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                {!!s.desc && <Text style={styles.stepDesc}>{s.desc}</Text>}
              </View>
            </View>
          ))}
        </View>
      );
    case 'table':
      return (
        <View style={styles.table}>
          {block.rows.map(([l, r], i) => (
            <View key={i} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
              <Text style={styles.tableL}>{l}</Text>
              <Text style={styles.tableR}>{r}</Text>
            </View>
          ))}
        </View>
      );
    case 'tip':
      return (
        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>{block.icon}</Text>
          <Text style={styles.tipText}>{block.text}</Text>
        </View>
      );
    case 'chips':
      return (
        <View style={styles.chipWrap}>
          {block.items.map((c, i) => (
            <View key={i} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
          ))}
        </View>
      );
    case 'qa':
      return (
        <View>
          {block.items.map((qa, i) => (
            <View key={i} style={styles.qaCard}>
              <View style={styles.qaQRow}>
                <Text style={styles.qaQMark}>Q</Text>
                <Text style={styles.qaQ}>{qa.q}</Text>
              </View>
              <Text style={styles.qaA}>{qa.a}</Text>
            </View>
          ))}
        </View>
      );
  }
}

export default function GuideScreen() {
  const { isDark, colors } = useTheme();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  return (
    <ScrollView
      style={[styles.screen, isDark && { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* ヘッダー */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>産前産後ケアホテル ぶどうの木 から</Text>
        <Text style={styles.heroTitle}>We育 使い方ガイド</Text>
        <Text style={styles.heroLead}>{LEAD}</Text>
      </View>

      {/* はじめに、ふたりへ */}
      <View style={styles.introBox}>
        <Text style={styles.introTitle}>{INTRO_TITLE}</Text>
        <Text style={styles.introBody}>{INTRO_BODY}</Text>
      </View>

      {/* 章（アコーディオン） */}
      {CHAPTERS.map((ch) => {
        const isOpen = open.has(ch.n);
        return (
          <Card key={ch.n} style={styles.chapter}>
            <TouchableOpacity style={styles.chapterHead} onPress={() => toggle(ch.n)} activeOpacity={0.7}>
              <View style={styles.chapterNum}><Text style={styles.chapterNumText}>{ch.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterTitle}>{ch.title}</Text>
                <Text style={styles.chapterSub}>{ch.subtitle}</Text>
              </View>
              {isOpen ? <ChevronUp size={20} color={SUBINK} /> : <ChevronDown size={20} color={SUBINK} />}
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.chapterBody}>
                {ch.blocks.map((b, i) => <BlockView key={i} block={b} />)}
              </View>
            )}
          </Card>
        );
      })}

      <Text style={styles.footer}>We育 ｜ 0〜6歳の育児を、ふたりでシェア{'\n'}産前産後ケアホテル ぶどうの木 ｜ we-iku.com</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },

  hero: { marginBottom: 14 },
  heroEyebrow: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#D97757', marginBottom: 4 },
  heroTitle: { fontSize: 24, fontFamily: fonts.bodyBold, color: PURPLE_DEEP, marginBottom: 8 },
  heroLead: { fontSize: 13, fontFamily: fonts.body, color: INK, lineHeight: 20 },

  introBox: { backgroundColor: CREAM, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  introTitle: { fontSize: 15, fontFamily: fonts.bodyBold, color: PURPLE_DEEP, marginBottom: 8 },
  introBody: { fontSize: 12.5, fontFamily: fonts.body, color: INK, lineHeight: 20 },

  chapter: { padding: 0, marginBottom: 10, overflow: 'hidden' },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  chapterNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  chapterNumText: { fontSize: 13, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  chapterTitle: { fontSize: 16, fontFamily: fonts.bodyBold, color: INK },
  chapterSub: { fontSize: 11, fontFamily: fonts.body, color: SUBINK, marginTop: 2 },
  chapterBody: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },

  para: { fontSize: 13, fontFamily: fonts.body, color: INK, lineHeight: 20 },
  inlineNew: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#E11D48' },

  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  subDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PURPLE },
  subText: { fontSize: 14, fontFamily: fonts.bodyBold, color: PURPLE_DEEP },

  featWrap: { gap: 8 },
  featCard: { backgroundColor: CREAM, borderRadius: radius.md, padding: 12 },
  featHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' },
  featIcon: { fontSize: 16 },
  featTitle: { fontSize: 13.5, fontFamily: fonts.bodyBold, color: INK },
  featDesc: { fontSize: 12.5, fontFamily: fonts.body, color: INK, lineHeight: 19 },

  stepCard: { flexDirection: 'row', gap: 12, backgroundColor: CREAM, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F6B5A0', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  stepTitle: { fontSize: 13.5, fontFamily: fonts.bodyBold, color: INK },
  stepDesc: { fontSize: 12.5, fontFamily: fonts.body, color: INK, lineHeight: 19, marginTop: 3 },

  table: { borderWidth: 1, borderColor: PURPLE_SOFT, borderRadius: radius.md, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 11, gap: 10 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: PURPLE_SOFT },
  tableL: { width: 110, fontSize: 12, fontFamily: fonts.bodyBold, color: PURPLE_DEEP },
  tableR: { flex: 1, fontSize: 12, fontFamily: fonts.body, color: INK, lineHeight: 18 },

  tipBox: { flexDirection: 'row', gap: 8, backgroundColor: PINK_SOFT, borderRadius: radius.md, padding: 12 },
  tipIcon: { fontSize: 14 },
  tipText: { flex: 1, fontSize: 12.5, fontFamily: fonts.bodySemibold, color: '#9D174D', lineHeight: 19 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: AMBER_SOFT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11.5, fontFamily: fonts.bodySemibold, color: '#92400E' },

  qaCard: { backgroundColor: CREAM, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  qaQRow: { flexDirection: 'row', gap: 7, marginBottom: 5 },
  qaQMark: { fontSize: 13, fontFamily: fonts.bodyBold, color: '#DB2777' },
  qaQ: { flex: 1, fontSize: 13, fontFamily: fonts.bodyBold, color: INK, lineHeight: 19 },
  qaA: { fontSize: 12.5, fontFamily: fonts.body, color: INK, lineHeight: 19, paddingLeft: 20 },

  newBadge: { backgroundColor: '#FB7185', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  newBadgeText: { fontSize: 8, fontFamily: fonts.bodyBold, color: '#FFFFFF' },

  footer: { fontSize: 10.5, fontFamily: fonts.body, color: SUBINK, textAlign: 'center', lineHeight: 17, marginTop: 18 },
});
