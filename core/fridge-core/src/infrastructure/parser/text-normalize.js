// Fiş OCR'ı Türkçe harfleri sık sık bozuyor (İ/Ì karışması, Ğ'nin "à" gibi
// yanlış kod sayfasından okunması) ve bazen model çıktısına Kiril/Yunan
// görsel ikizleri (homoglif) karışıyor — "Milktен" gibi, burada "ен" aslında
// Kiril "е" ve "н". İkisi de deterministik, tabloya dayalı düzeltiliyor;
// AI'ın kararına bırakılmıyor.

// Ham fiş metninde gözlenen OCR kod sayfası kaymaları. Kapsamlı bir liste
// değil — modele gitmeden önce en sık görülen bozulmaları düzeltip modelin
// işini kolaylaştırmak amaçlı. Belirsiz/nadir durumlar dokunulmadan geçer.
const OCR_FIXES = [
  [/Ì/g, 'İ'],
  [/ì/g, 'i'],
  [/à/g, 'ğ'],
  [/À/g, 'Ğ'],
  [/ò/g, 'ö'],
  [/Ò/g, 'Ö'],
];

const normalizeOcrArtifacts = (rawText) => {
  let text = rawText ?? '';
  for (const [pattern, replacement] of OCR_FIXES) {
    text = text.replace(pattern, replacement);
  }
  return text;
};

// Kiril/Yunan harflerinin Latin'e görsel ikizleri. Yalnızca gerçekten
// karışan harfler var — Türkçe'ye özgü Latin-genişletilmiş harfler
// (ı İ ş Ş ğ Ğ ü Ü ö Ö ç Ç) bu tabloda YOK ve dokunulmuyor.
const HOMOGLYPH_MAP = {
  а: 'a', А: 'A', // Cyrillic a
  е: 'e', Е: 'E', // Cyrillic ie
  о: 'o', О: 'O', // Cyrillic o
  р: 'p', Р: 'P', // Cyrillic er
  с: 'c', С: 'C', // Cyrillic es
  у: 'y', У: 'Y', // Cyrillic u
  х: 'x', Х: 'X', // Cyrillic ha
  к: 'k', К: 'K', // Cyrillic ka
  н: 'n', Н: 'N', // Cyrillic en
  т: 't', Т: 'T', // Cyrillic te
  м: 'm', М: 'M', // Cyrillic em
  в: 'v', В: 'B', // Cyrillic ve (görsel B'ye yakın)
};

const HOMOGLYPH_PATTERN = new RegExp(Object.keys(HOMOGLYPH_MAP).join('|'), 'g');

// Model çıktısındaki Kiril/Yunan homoglifleri temizler. Karışık dilli
// (Türkçe+Kiril) bir kelimeyi ("Milktен") tamamen Latin'e çevirir.
const stripHomoglyphs = (text) => (text ?? '').replace(HOMOGLYPH_PATTERN, (ch) => HOMOGLYPH_MAP[ch]);

export { normalizeOcrArtifacts, stripHomoglyphs };
