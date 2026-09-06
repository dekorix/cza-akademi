export const presentationPresets = [2000,1500,1000,900,800,700,600,500,400,300,250,200,150,100,80] as const;
export const answerPresets = [0,3000,5000,10000,15000] as const;

export function speedLabel(durationMs: number) {
  if (durationMs >= 1500) return 'Başlangıç';
  if (durationMs >= 800) return 'Rahat';
  if (durationMs >= 500) return 'Akıcı';
  if (durationMs >= 300) return 'Hızlı';
  if (durationMs >= 200) return 'Çok hızlı';
  return 'Uzman';
}

export function durationLabel(durationMs: number) {
  if (durationMs === 0) return 'Sınırsız';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(durationMs / 1000)} sn · ${durationMs} ms`;
}

export function progressionSuggestion(accuracy: number, validQuestionCount: number, durationMs: number) {
  const index = presentationPresets.indexOf(durationMs as (typeof presentationPresets)[number]);
  if (validQuestionCount < 10) return 'Yeni bir hız önermeden önce bu ayarda en az 10 geçerli soru tamamla.';
  if (accuracy >= 90 && index >= 0 && index < presentationPresets.length - 1) return `Bu hızda kararlı görünüyorsun. Eğitmenin bir sonraki çalışmada ${durationLabel(presentationPresets[index + 1])} seçeneğini değerlendirebilir.`;
  if (accuracy < 70 && index > 0) return `Bu hız henüz kararlı görünmüyor. Eğitmenin ${durationLabel(presentationPresets[index - 1])} ile kısa bir sağlamlaştırma çalışması planlayabilir.`;
  return 'Bu ayarda birkaç tutarlı çalışma daha yapmak uygun görünüyor.';
}
