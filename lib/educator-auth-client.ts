export async function educatorAuthRequest(values: Record<string, unknown>) {
  const response = await fetch('/api/educator-auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'auth_unavailable');
  }
  return data;
}

export function educatorAuthError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'invalid_credentials') return 'E-posta veya parola hatalı. Parolanı bilmiyorsan “İlk parolamı oluştur / parolamı yenile” bağlantısını kullan.';
  if (code === 'invalid_reset') return 'Parola bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.';
  if (code === 'reset_unavailable') return 'Parola e-postası şu anda gönderilemedi. Birkaç saniye sonra yeniden dene.';
  if (code === 'session_not_created') return 'Giriş doğrulandı ancak CZA Eğitimci oturumu oluşturulamadı. Sistem yöneticisi bağlantısını kontrol etmeli.';
  if (code === 'rate_limited') return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.';
  if (code === 'request_origin_rejected') return 'Güvenlik doğrulaması tamamlanamadı. CZA’nın resmi bağlantısından tekrar aç.';
  return 'Giriş hizmetine şu anda ulaşılamıyor. Lütfen yeniden dene.';
}
