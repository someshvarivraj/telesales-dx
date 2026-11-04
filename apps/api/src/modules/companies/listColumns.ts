/** Company fields a list column can map to. */
export type ListField =
  | 'name'
  | 'phone'
  | 'url'
  | 'sourceUrl'
  | 'office'
  | 'department'
  | 'postalCode'
  | 'address'
  /** 住所2: joined onto 住所1 (the address stays one field, Sano 10/28 ④). */
  | 'address2'
  | 'prefecture'
  | 'city'
  | 'nearestStation'
  | 'walkMinutes'
  | 'capital'
  | 'industry'
  | 'customerType'
  | 'clientNo'
  | 'companyRank'
  | 'parentName';

/**
 * Header names (after NFKC normalisation) for each field. Only name, phone and URL are
 * required (spec §9-1); other columns are matched if present, everything else is kept as extra.
 */
const HEADER_ALIASES: Record<ListField, readonly string[]> = {
  name: ['会社名', '企業名', '社名', '法人名'],
  phone: ['電話番号', '電話', 'TEL', '代表TEL', '代表電話', '代表電話番号'],
  url: [
    'URL',
    'HP',
    '公式HP',
    '公式HPのURL',
    'ホームページ',
    'ホームページURL',
    'WebサイトURL',
    'Webサイト',
  ],
  sourceUrl: ['引用先URL', '掲載元URL', '掲載元のURL', '出典URL'],
  office: ['事業所', '事業所名', '支店名', '拠点'],
  department: ['部署', '部署名'],
  postalCode: ['郵便番号', '〒'],
  address: ['住所', '所在地', '住所1'],
  address2: ['住所2'],
  prefecture: ['都道府県'],
  city: ['市区町村'],
  nearestStation: ['最寄駅', '最寄り駅'],
  walkMinutes: ['徒歩', '徒歩分', '徒歩(分)', '駅徒歩'],
  capital: ['資本金'],
  industry: ['業種', '業界'],
  customerType: ['取引区分'],
  clientNo: ['クライアントNo', 'クライアントNo.', 'クライアント番号', 'ｸﾗｲｱﾝﾄNo'],
  companyRank: ['企業ランク', 'ランク', '上場区分'],
  parentName: ['親会社名', '親会社'],
};

const lookup = new Map<string, ListField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ListField, readonly string[]][]) {
  for (const alias of aliases) {
    lookup.set(alias.normalize('NFKC').toUpperCase(), field);
  }
}

/**
 * `note` is the rest of the header cell: the Telema template writes instructions under the
 * name, and its 「住所3」 column is really 企業ランク (「・企業ランク必須」).
 */
export function fieldForHeader(header: string, note = ''): ListField | null {
  if (/企業ランク/.test(note)) {
    return 'companyRank';
  }
  return lookup.get(header.normalize('NFKC').replace(/\s/g, '').toUpperCase()) ?? null;
}

/**
 * 「会社名\n・(株)ではなく株式会社…」 → name 会社名, note the rest. 「※入力不要」 (filled in by
 * listcheck, not by the list maker) is dropped from the name.
 */
export function splitHeaderCell(text: string): { header: string; note: string } {
  const lines = text
    .normalize('NFKC')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim());
  const index = lines.findIndex((line) => line.replace(/^※入力不要/, '').trim() !== '');
  if (index < 0) {
    return { header: '', note: '' };
  }
  return {
    header: (lines[index] ?? '').replace(/^※入力不要/, '').trim(),
    note: lines.slice(index + 1).join('\n'),
  };
}

export const REQUIRED_LIST_FIELDS: readonly ListField[] = ['name', 'phone', 'url'];

export const LIST_FIELD_LABEL: Record<ListField, string> = {
  name: '会社名',
  phone: '電話番号',
  url: 'URL',
  sourceUrl: '掲載元のURL',
  office: '事業所',
  department: '部署',
  postalCode: '郵便番号',
  address: '住所',
  address2: '住所2',
  prefecture: '都道府県',
  city: '市区町村',
  nearestStation: '最寄駅',
  walkMinutes: '徒歩（分）',
  capital: '資本金',
  industry: '業種',
  customerType: '取引区分',
  clientNo: 'クライアントNo',
  companyRank: '企業ランク',
  parentName: '親会社名',
};
