export type CoreStudent = {
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  username?: string;
};

export async function core(
  action: string,
  values: Record<string, unknown> = {},
) {
  const response = await fetch('/api/core', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  const error =
    typeof data.error === 'string' ? data.error : 'core_unavailable';
  if (!response.ok || data.ok === false) throw new Error(error);
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
  if (code === 'IDEMPOTENCY_KEY_REUSED')
    return 'Aynı kayıt kimliği farklı bir yanıt için yeniden kullanılamaz.';
  return 'Merkezi kayıt sistemine şu anda ulaşılamıyor. Bağlantını kontrol edip tekrar dene.';
}
