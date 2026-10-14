/** Company fields a list column can map to. */
export type ListField =
  | 'name'
  | 'phone'
  | 'url'
  | 'office'
  | 'department'
  | 'address'
  | 'prefecture'
  | 'city'
  | 'nearestStation'
  | 'industry'
  | 'customerType'
  | 'clientNo';

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
  office: ['事業所', '事業所名', '支店名', '拠点'],
  department: ['部署', '部署名'],
  address: ['住所', '所在地'],
  prefecture: ['都道府県'],
  city: ['市区町村'],
  nearestStation: ['最寄駅', '最寄り駅'],
  industry: ['業種', '業界'],
  customerType: ['取引区分'],
  clientNo: ['クライアントNo', 'クライアントNo.', 'クライアント番号', 'ｸﾗｲｱﾝﾄNo'],
};

const lookup = new Map<string, ListField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ListField, readonly string[]][]) {
  for (const alias of aliases) {
    lookup.set(alias.normalize('NFKC').toUpperCase(), field);
  }
}

export function fieldForHeader(header: string): ListField | null {
  return lookup.get(header.normalize('NFKC').replace(/\s/g, '').toUpperCase()) ?? null;
}

export const REQUIRED_LIST_FIELDS: readonly ListField[] = ['name', 'phone', 'url'];

export const LIST_FIELD_LABEL: Record<ListField, string> = {
  name: '会社名',
  phone: '電話番号',
  url: 'URL',
  office: '事業所',
  department: '部署',
  address: '住所',
  prefecture: '都道府県',
  city: '市区町村',
  nearestStation: '最寄駅',
  industry: '業種',
  customerType: '取引区分',
  clientNo: 'クライアントNo',
};
