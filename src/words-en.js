// English glosses for the course, keyed by word id ("kana|kanji"). Used in the English and Japanese interfaces.
// A word entry is [gloss, note]; a note left out falls back to the Russian note only when that note has no Russian text in it.
window.TANGO_EN = (() => {
const W = {
 // Lesson 1
 'だいがく|大学': ['college; university'], 'こうこう|高校': ['high school'], 'がくせい|学生': ['student'],
 'だいがくせい|大学生': ['college student'], 'りゅうがくせい|留学生': ['international student'], 'せんせい|先生': ['teacher; professor'],
 '〜ねんせい|〜年生': ['…-year student', 'いちねんせい — first-year student'], 'せんこう|専攻': ['major (subject)'],
 'わたし|私': ['I'], 'ともだち|友達': ['friend'], '〜さん|': ['Mr./Ms. …'], '〜じん|〜人': ['… people (nationality)', 'にほんじん — Japanese person'],
 'いま|今': ['now'], 'ごぜん|午前': ['a.m.'], 'ごご|午後': ['p.m.'], '〜じ|〜時': ['… o’clock', 'いちじ — one o’clock'],
 'はん|半': ['half', 'にじはん — half past two'],
 'にほん|日本': ['Japan'], 'アメリカ|': ['U.S.A.'], '〜ご|〜語': ['… language', 'にほんご — Japanese language'], '〜さい|〜歳': ['… years old'],
 'でんわ|電話': ['telephone'], '〜ばん|〜番': ['number …'], 'ばんごう|番号': ['number'], 'でんわばんごう|電話番号': ['telephone number'],
 'なまえ|名前': ['name'], 'なん|何': ['what', 'also なに'],
 'あのう|': ['um… (to get attention)'], 'はい|': ['yes'], 'そうです|': ['that’s right'], 'そうですか|': ['I see; is that so?'],
 'イギリス|': ['Britain'], 'オーストラリア|': ['Australia'], 'かんこく|韓国': ['South Korea'], 'カナダ|': ['Canada'], 'ちゅうごく|中国': ['China'],
 'インド|': ['India'], 'エジプト|': ['Egypt'], 'フィリピン|': ['Philippines'], 'ロシア|': ['Russia'],
 'アジアけんきゅう|アジア研究': ['Asian studies'], 'けいざい|経済': ['economics'], 'こうがく|工学': ['engineering'],
 'こくさいかんけい|国際関係': ['international relations'], 'コンピューター|': ['computer; computer science'], 'せいじ|政治': ['politics'],
 'せいぶつがく|生物学': ['biology'], 'ビジネス|': ['business'], 'ぶんがく|文学': ['literature'], 'れきし|歴史': ['history'],
 'いしゃ|医者': ['doctor'], 'かいしゃいん|会社員': ['office worker'], 'かんごし|看護師': ['nurse'], 'こうこうせい|高校生': ['high school student'],
 'しゅふ|主婦': ['housewife'], 'だいがくいんせい|大学院生': ['graduate student'], 'べんごし|弁護士': ['lawyer'],
 'おかあさん|お母さん': ['mother'], 'おとうさん|お父さん': ['father'], 'おねえさん|お姉さん': ['older sister'], 'おにいさん|お兄さん': ['older brother'],
 'いもうと|妹': ['younger sister'], 'おとうと|弟': ['younger brother'],
 // Lesson 3
 'いく|行く': ['to go', 'group 1: いきます'], 'はなす|話す': ['to speak', 'group 1: はなします'], 'のむ|飲む': ['to drink', 'group 1: のみます'],
 'よむ|読む': ['to read', 'group 1: よみます'], 'かえる|帰る': ['to go back; to return', 'exception, group 1: かえります'],
 'おきる|起きる': ['to get up; to wake up', 'group 2: おきます'], 'たべる|食べる': ['to eat', 'group 2: たべます'],
 'ねる|寝る': ['to sleep; to go to bed', 'group 2: ねます'], 'みる|見る': ['to see; to watch', 'group 2: みます'],
 'くる|来る': ['to come', 'irregular: きます'], 'する|': ['to do', 'irregular: します'], 'べんきょうする|勉強する': ['to study', 'like する: べんきょうします'],
 'まいにち|毎日': ['every day'], 'よく|': ['often'], 'たいてい|': ['usually'], 'ときどき|': ['sometimes'],
 'あまり|': ['not much; not often', 'only with a negative'], 'ぜんぜん|': ['not at all; never', 'only with a negative'],
 'ちょっと|': ['a little', 'also a polite “no”: それは ちょっと…'],
 // Lesson 4
 'にちようび|日曜日': ['Sunday', '日 — sun'], 'げつようび|月曜日': ['Monday', '月 — moon'], 'かようび|火曜日': ['Tuesday', '火 — fire'],
 'すいようび|水曜日': ['Wednesday', '水 — water'], 'もくようび|木曜日': ['Thursday', '木 — tree'], 'きんようび|金曜日': ['Friday', '金 — gold'],
 'どようび|土曜日': ['Saturday', '土 — earth'],
 'おととい|': ['the day before yesterday', 'not to be confused with おととし'], 'きのう|昨日': ['yesterday'], 'きょう|今日': ['today'],
 'あした|明日': ['tomorrow'], 'あさって|': ['the day after tomorrow'], 'にしゅうかんまえ|二週間前': ['two weeks ago'],
 'せんしゅう|先週': ['last week', 'せん = last'], 'こんしゅう|今週': ['this week', 'こん = this'], 'らいしゅう|来週': ['next week', 'らい = next'],
 'さらいしゅう|再来週': ['the week after next', 'さらい = after next'], 'にかげつまえ|二か月前': ['two months ago'],
 'せんげつ|先月': ['last month'], 'こんげつ|今月': ['this month'], 'らいげつ|来月': ['next month'], 'さらいげつ|再来月': ['the month after next'],
 'おととし|': ['the year before last', 'not to be confused with おととい'], 'きょねん|去年': ['last year', 'not せんねん!'],
 'ことし|今年': ['this year', 'not こんねん!'], 'らいねん|来年': ['next year'], 'さらいねん|再来年': ['the year after next'],
 'ある|': ['there is (things)', 'group 1: あります'], 'いる|': ['there is (people, animals)', 'group 2: います'],
 'かう|買う': ['to buy', 'group 1: かいます'], 'まつ|待つ': ['to wait', 'group 1: まちます'], 'とる|撮る': ['to take (a picture)', 'しゃしんを とります'],
 'たくさん|': ['many; a lot'], '〜じかん|〜時間': ['… hours (duration)', 'いちじかん — one hour, no particle'],
 'ぐらい|': ['about; approximately', 'さんじかんぐらい — about three hours'], 'まえ|前': ['in front of', 'ホテルの まえ — in front of the hotel'],
 // Lesson 5
 'たべもの|食べ物': ['food'], 'のみもの|飲み物': ['drink'], 'くだもの|果物': ['fruit'], 'やすみ|休み': ['holiday; day off'],
 'りょこう|旅行': ['travel; trip'], 'うみ|海': ['sea'], 'サーフィン|': ['surfing'], 'おみやげ|お土産': ['souvenir'], 'バス|': ['bus'],
 'てんき|天気': ['weather'], 'しゅくだい|宿題': ['homework'], 'テスト|': ['test; exam'], 'たんじょうび|誕生日': ['birthday'],
 'へや|部屋': ['room'], 'ぼく|僕': ['I (used by men)'], 'Ｌサイズ|': ['size L'],
 'あたらしい|新しい': ['new'], 'ふるい|古い': ['old (things)', 'only for things, not people'], 'あつい|暑い': ['hot (weather)'],
 'さむい|寒い': ['cold (weather)'], 'あつい|熱い': ['hot (an object)', 'tea, soup — 熱い'], 'いそがしい|忙しい': ['busy'],
 'おおきい|大きい': ['large'], 'ちいさい|小さい': ['small'], 'おもしろい|面白い': ['interesting; funny'], 'つまらない|': ['boring'],
 'やさしい|': ['easy; kind'], 'むずかしい|難しい': ['difficult'], 'かっこいい|': ['good-looking; cool', 'like いい: かっこよくない'],
 'こわい|怖い': ['frightening'], 'かわいい|': ['cute'], 'たのしい|楽しい': ['fun'], 'やすい|安い': ['inexpensive; cheap'],
 'たかい|高い': ['expensive; high'], 'いい|': ['good', 'exception: よくない, よかった'], 'おいしい|': ['delicious'],
 'すき|好き': ['fond of; to like'], 'きらい|嫌い': ['disgusted with; to dislike', 'ends in い, but it is a な-adjective'],
 'だいすき|大好き': ['very fond of; to love'], 'だいきらい|大嫌い': ['to hate'],
 'きれい|': ['beautiful; clean', 'ends in い, but it is a な-adjective: きれいな へや'], 'げんき|元気': ['healthy; energetic'],
 'しずか|静か': ['quiet'], 'にぎやか|': ['lively'], 'ひま|暇': ['not busy; free (time)'],
 'およぐ|泳ぐ': ['to swim', 'う · うみで およぎます'], 'きく|聞く': ['to ask; to listen', 'せんせいに ききます · おんがくを ききます'],
 'のる|乗る': ['to ride; to board', 'バスに のります (not を!)'], 'やる|': ['to do', 'サーフィンを やります'], 'でかける|出かける': ['to go out', 'る-verb'],
 'いっしょに|一緒に': ['together'], 'すごく|': ['extremely (casual)'], 'とても|': ['very'], 'だいじょうぶ|大丈夫': ['it’s okay; not to worry'],
 'どんな|': ['what kind of …'], '〜まい|〜枚': ['counter for flat objects'], '〜さつ|〜冊': ['counter for books'],
 'えいが|映画': ['movie', 'おもしろい えいが — an interesting movie'], 'しゃしん|写真': ['picture; photograph', 'しゃしんを とります — to take pictures'],
 'まち|町': ['town; city'], 'さかな|魚': ['fish'], 'としょかん|図書館': ['library'], 'カフェ|': ['café'], 'コーヒー|': ['coffee'],
 'がくしょく|学食': ['school cafeteria'], 'ケーキ|': ['cake'], 'かぞく|家族': ['family'], 'そと|外': ['outside'], 'きみ|君': ['you (casual)'],
 'ほんとう|本当': ['true; really', 'ほんとう？ — really?'], 'うん|': ['uh-huh; yes (casual)'], 'よかった|': ['I’m glad!; what a relief!', 'past tense of いい'],
 'そろそろ|': ['it’s about time to …', 'そろそろ ねましょうか — time for bed']
};
// numbers keep their digits; their notes say which other readings exist
const NUM_NOTES = { 'ゼロ|': 'also れい', 'よん|': 'also し; sometimes よ', 'なな|': 'also しち', 'きゅう|': 'also く',
  'じゅうよん|': 'also じゅうし', 'じゅうなな|': 'also じゅうしち', 'じゅうきゅう|': 'also じゅうく' };
const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const DATE_NOTES = { 4: 'not to be confused with ようか (8th)', 8: 'not to be confused with よっか (4th)', 14: '4 → よっか', 17: '7 → しち',
  19: '9 → く', 20: 'a special word', 24: '4 → よっか', 27: '7 → しち', 29: '9 → く' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NOTES = { 4: 'not よんがつ!', 7: 'not ながつ!', 9: 'not きゅうがつ!' };
return {
  // gloss and note of one word; null when the word has no English entry yet
  word(w) {
    if (W[w.id]) return W[w.id];
    if (w.topic === 'num1' || w.topic === 'num2' || w.topic === 'num3') return [w.ru, NUM_NOTES[w.id]];
    if (w.topic === 'dates') { const n = parseInt(w.kanji, 10); return [`the ${ord(n)} (of the month)`, DATE_NOTES[n]]; }
    if (w.topic === 'months') { const n = ['一','二','三','四','五','六','七','八','九','十','十一','十二'].indexOf(w.kanji.replace('月', '')) + 1; return [MONTHS[n - 1], MONTH_NOTES[n]]; }
    return null;
  },
  lessons: {
    l0: { en: ['Basics', 'Numbers 0 to 100'], ja: ['きほん', 'すうじ 0〜100'] },
    l1: { en: ['Lesson 1', 'Meeting people: who you are, where you’re from'], ja: ['だい1か', 'じこしょうかい'] },
    l3: { en: ['Lesson 3', 'Verbs, particles, time'], ja: ['だい3か', 'どうし・じょし・じかん'] },
    l4: { en: ['Lesson 4', 'There is, past tense, dates'], ja: ['だい4か', 'あります・かこ・ひづけ'] },
    l5: { en: ['Lesson 5', 'Adjectives'], ja: ['だい5か', 'けいようし'] }
  },
  topics: {
    num1: ['Numbers 0–10', 'すうじ 0〜10'], num2: ['Numbers 11–20', 'すうじ 11〜20'], num3: ['Tens up to 100', '30〜100'],
    l1school: ['School', 'がっこう'], l1person: ['People', 'ひと'], l1time: ['Time', 'じかん'], l1other: ['Other words', 'そのほか'],
    l1expr: ['Expressions', 'ひょうげん'], l1country: ['Countries', 'くに'], l1major: ['Majors', 'せんこう'], l1job: ['Occupations', 'しごと'], l1family: ['Family', 'かぞく'],
    l3verbs: ['Verbs', 'どうし'], l3adv: ['Frequency adverbs', 'ひんどの ふくし'],
    week: ['Days of the week', 'ようび'], dates: ['Days of the month', 'ひづけ'], months: ['Months', 'つき'], time: ['Time words', 'ときの ことば'],
    l4words: ['Words from the grammar', 'ぶんぽうの ことば'],
    nouns: ['Nouns', 'めいし'], iadj: ['い-adjectives', 'い けいようし'], naadj: ['な-adjectives', 'な けいようし'], verbs: ['Verbs', 'どうし'], adv: ['Adverbs and counters', 'ふくし・じょすうし'], l5more: ['From the slides: movies, cafés, family', 'スライドの ことば']
  },
  drills: {
    l3conj: ['Verb forms: 〜ます and 〜ません', 'どうし：〜ます・〜ません'], l3part: ['Particles を で に へ', 'じょし を で に へ'],
    l3time: ['Time: is に needed?', 'じかんと に'], l3order: ['Word order', 'ごじゅん'],
    l4aru: ['あります or います', 'あります・います'], l4past: ['Past: 〜ました and 〜ませんでした', 'かこけい'],
    l4part: ['も, と, で and duration', 'も・と・で'], l4order: ['Build the sentence', 'ぶんを つくる'],
    l5pres: ['Adjectives: negative', 'けいようし：ひてい'], l5past: ['Adjectives: past tense', 'けいようし：かこ'], l5sent: ['Translate the sentence', 'ほんやく'],
    l5adjn: ['Adjective + noun', 'けいようし＋めいし'], l5suki: ['すき and きらい', 'すき・きらい'],
    l5let: ['Let’s: 〜ましょう and 〜ませんか', 'さそう：〜ましょう・〜ませんか'], l5order2: ['Build the sentence: new topics', 'ぶんを つくる 2']
  }
};
})();
