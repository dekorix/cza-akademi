export type CoreStudent = {
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  username?: string;
};

export class CoreClientError extends Error {
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'CoreClientError';
    this.status = status;
  }
}

export async function core(
  action: string,
  values: Record<string, unknown> = {},
) {
  let response: Response;
  try {
    response = await fetch('/api/core', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...values }),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new CoreClientError('network_unavailable', 0);
    throw error;
  }
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await response.text()) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CoreClientError('invalid_response', response.status);
    }
    data = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CoreClientError) throw error;
    throw new CoreClientError('invalid_response', response.status);
  }
  const errorCode =
    typeof data.error === 'string' ? data.error : 'core_unavailable';
  if (!response.ok || data.ok === false) throw new CoreClientError(errorCode, response.status);
  return data;
}

export function coreStudent(data: Record<string, unknown>): CoreStudent {
  return (data.student || data.user || data.profile || data) as CoreStudent;
}

export function studentName(student: CoreStudent) {
  return (
    student.fullName ||
    student.name ||
    [student.firstName, student.lastName].filter(Boolean).join(' ') ||
    student.username ||
    'Öğrenci'
  );
}

export function friendlyCoreError(error: unknown) {
  const code = error instanceof Error ? error.message : 'unknown';
  if (code === 'invalid_credentials') return 'Kullanıcı adı veya PIN hatalı.';
  if (code === 'invalid_request')
    return 'Giriş isteği okunamadı. Sayfayı yenileyip yeniden dene.';
  if (code === 'invalid_request_schema')
    return 'Giriş bilgileri eksik veya biçimi uygun değil. Yeniden dene.';
  if (code === 'qa_login_unavailable')
    return 'Öğrenci girişi şu anda tamamlanamıyor. Biraz sonra yeniden dene.';
  if (code === 'core_configuration_unavailable')
    return 'Öğrenci kayıt servisi bu ortamda hazır değil. Biraz sonra yeniden dene.';
  if (code === 'network_unavailable')
    return 'Bağlantı kurulamadı. Ağını kontrol edip yeniden dene.';
  if (code === 'invalid_response')
    return 'Sunucu geçerli bir yanıt vermedi. Biraz sonra yeniden dene.';
  if (code === 'session_required' || code === 'invalid_session')
    return 'Oturumun sona erdi. Yeniden giriş yap.';
  if (code === 'request_origin_rejected')
    return 'Güvenlik doğrulaması tamamlanamadı.';
  if (code === 'rate_limited')
    return 'Çok fazla deneme yapıldı. Lütfen kısa süre sonra yeniden dene.';
  if (code === 'rate_limit_unavailable')
    return 'Güvenlik sayacı şu anda doğrulanamıyor. Lütfen biraz sonra yeniden dene.';
  if (code === 'logout_revocation_failed' || code === 'database_unavailable')
    return 'Güvenli çıkış sunucuda tamamlanamadı.';
  if (code === 'session_not_created') return 'Bu çalışma oturumu açılamadı.';
  if (code === 'module_access_required') return 'Bu çalışma alanı paket erişimine bağlı. Eğitimcin paketini aktive ettiğinde açılacak.';
  if (code === 'package_schema_unavailable') return 'Paket erişim sistemi bu ortamda henüz hazır değil.';
  if (code === 'assignment_completed')
    return 'Bu atanmış çalışma daha önce tamamlandı.';
  if (code === 'unsupported_assignment_module')
    return 'Bu çalışma motoru henüz etkin değil.';
  if (code === 'work_incomplete')
    return 'Çalışma henüz tamamlanmadı; ilerlemen kaydedildi.';
  if (code === 'work_not_found' || code === 'work_session_closed')
    return 'Bu çalışma oturumu artık kullanılamıyor.';
  if (code === 'work_question_conflict')
    return 'Bu soru başka sekmede kaydedildi. Sayfayı yenileyip kaydedilmiş ilerlemenden devam et.';
  if (code === 'work_assignment_closed' || code === 'assignment_not_found')
    return 'Bu atama artık çalışmaya açık değil. Çalışma merkezine dön.';
  if (code === 'IDEMPOTENCY_KEY_REUSED')
    return 'Aynı kayıt kimliği farklı bir yanıt için yeniden kullanılamaz.';
  return 'Merkezi kayıt sistemine şu anda ulaşılamıyor. Bağlantını kontrol edip tekrar dene.';
}
