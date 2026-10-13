import { ErrorCode, PASSWORD_MIN_LENGTH, Role } from '@telesales/shared';

/**
 * All user-facing text lives here so wording stays consistent and reviewable.
 * Common loanwords stay in katakana (ログイン, パスワード, テレマ, アポ…).
 */
export const ja = {
  app: {
    name: 'テレマ・営業DX',
  },
  role: {
    [Role.Telema]: 'テレマ',
    [Role.TelemaLead]: 'リーダー',
    [Role.Sales]: '営業',
    [Role.Viewer]: '閲覧',
    [Role.Admin]: '管理者',
  },
  module: {
    calls: '架電状況共有',
    schedule: 'スケジュール管理',
    appointments: 'アポ一覧',
  },
  admin: {
    title: '管理',
    users: 'ユーザー・役割',
    calendar: '祝日・会社の休日',
    areaTable: '営業担当表',
    options: '選択肢',
    notices: '通知の宛先',
    locks: '編集中の押さえ',
  },
  auth: {
    loginTitle: 'ログイン',
    email: 'メールアドレス',
    password: 'パスワード',
    submitLogin: 'ログイン',
    loggingIn: 'ログイン中…',
    logout: 'ログアウト',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを非表示',
    forgotPassword: 'パスワードを忘れた場合は、管理者にお問い合わせください。',
    changePasswordTitle: 'パスワードの変更',
    mustChangePassword: '初回ログインのため、パスワードを変更してください。',
    currentPassword: '現在のパスワード',
    newPassword: '新しいパスワード',
    confirmPassword: '新しいパスワード（確認）',
    passwordHint: `${PASSWORD_MIN_LENGTH}文字以上で入力してください。`,
    submitChangePassword: '変更する',
    changing: '変更中…',
    passwordChanged: 'パスワードを変更しました。',
  },
  validation: {
    required: (field: string) => `${field}を入力してください。`,
    email: 'メールアドレスの形式で入力してください。',
    passwordTooShort: `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください。`,
    passwordMismatch: '新しいパスワードが一致しません。',
  },
  home: {
    title: 'メニュー',
  },
  common: {
    required: '必須',
    backToHome: 'ホームへ戻る',
    loading: '読み込み中…',
    comingSoon: 'この画面は準備中です。',
  },
  system: {
    notFoundTitle: 'ページが見つかりません',
    notFoundBody: 'URLが正しいかご確認ください。',
    forbiddenTitle: 'このページを表示する権限がありません',
  },
  error: {
    [ErrorCode.InvalidCredentials]: 'メールアドレスまたはパスワードが正しくありません。',
    [ErrorCode.AccountLocked]:
      'ログインに続けて失敗したため、一時的にロックされています。しばらくしてから再度お試しください。',
    [ErrorCode.RateLimited]: '試行回数が上限に達しました。しばらくしてから再度お試しください。',
    [ErrorCode.PasswordReuse]: '現在のパスワードとは異なるパスワードを設定してください。',
    [ErrorCode.Unauthenticated]: 'ログインの有効期限が切れました。再度ログインしてください。',
    [ErrorCode.Forbidden]: 'この操作を行う権限がありません。',
    [ErrorCode.ValidationFailed]: '入力内容をご確認ください。',
    network: '通信エラーが発生しました。ネットワークの接続をご確認ください。',
    unexpected: 'エラーが発生しました。時間をおいて再度お試しください。',
  },
} as const;
