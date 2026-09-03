/** Original pilot lessons. Physical finger technique requires educator observation. */
export type BeadAction = { place: number; deck: 'upper' | 'lower'; bead: number };
export type BeadMove = BeadAction & { before: number; after: number };
export type TeachingStep = { before: number; after: number; action: BeadAction; instruction: string; finger: string };
export type TeachingTask = { id: string; prompt: string; start: number; target: number; digits: number; rule: string; steps: TeachingStep[] };
export type LessonId = 'beads' | 'places' | 'direct-add' | 'direct-subtract' | 'five-add' | 'five-subtract' | 'ten-add' | 'ten-subtract';
export type Lesson = { id: LessonId; title: string; subtitle: string; goal: string; ideas: string[]; educatorNote: string; examples: TeachingTask[]; practice: TeachingTask[] };
export type LessonAnswer = { taskId: string; given: number; correct: boolean; routeMatch: boolean; moves: BeadMove[]; hintUsed: boolean };
export type LessonRecord = { id: string; lessonId: LessonId; at: string; answers: LessonAnswer[]; guidedCorrections: number };

export const placeName = (place: number) => ({ 1: 'Birler', 10: 'Onlar', 100: 'Yüzler' }[place] || String(place));

export function applyBeadAction(value: number, digits: number, action: BeadAction): number {
  if (!Number.isInteger(digits) || digits < 1 || digits > 3 || !Number.isInteger(value) || value < 0 || value >= 10 ** digits ||
      ![1,10,100].includes(action.place) || action.place >= 10 ** digits ||
      !['upper','lower'].includes(action.deck) || !Number.isInteger(action.bead) || action.bead < 0 ||
      action.bead > (action.deck === 'upper' ? 0 : 3)) throw new Error('Geçersiz soroban hareketi.');
  const digit = Math.floor(value / action.place) % 10;
  const next = action.deck === 'upper' ? (digit >= 5 ? digit - 5 : digit + 5) :
    (digit >= 5 ? 5 : 0) + (action.bead < digit % 5 ? action.bead : action.bead + 1);
  return value + (next - digit) * action.place;
}

function makeStep(before: number, digits: number, action: BeadAction): TeachingStep {
  const after = applyBeadAction(before, digits, action);
  const delta = after - before;
  const count = Math.abs(delta) / action.place / (action.deck === 'upper' ? 5 : 1);
  return {
    before, after, action,
    instruction: `${placeName(action.place)} basamağında ${count} ${action.deck === 'upper' ? 'üst' : 'alt'} boncuğu ${delta > 0 ? 'orta çubuğa yaklaştır' : 'orta çubuktan uzaklaştır'} (${delta > 0 ? '+' : '−'}${Math.abs(delta)}).`,
    finger: action.deck === 'lower' && delta > 0 ? 'Fiziksel sorobanda: başparmakla yukarı.' :
      action.deck === 'lower' ? 'Fiziksel sorobanda: işaret parmağıyla aşağı.' :
      `Fiziksel sorobanda: işaret parmağıyla ${delta > 0 ? 'aşağı' : 'yukarı'}.`,
  };
}

/** A direct change has no exchange between upper/lower beads. */
export function canChangeDirectly(from: number, to: number): boolean {
  if (![from,to].every(v => Number.isInteger(v) && v >= 0 && v <= 9)) return false;
  return to >= from ? Math.floor(to/5) >= Math.floor(from/5) && to%5 >= from%5 :
    Math.floor(to/5) <= Math.floor(from/5) && to%5 <= from%5;
}

function directSteps(start: number, target: number, digits: number): TeachingStep[] {
  let value = start;
  const steps: TeachingStep[] = [];
  for (let power = digits - 1; power >= 0; power--) {
    const place = 10 ** power;
    const from = Math.floor(value/place)%10;
    const to = Math.floor(target/place)%10;
    if (!canChangeDirectly(from,to)) throw new Error('Bu adım doğrudan boncuk hareketi değil.');
    // Digital clicks separate motions; this is not a claim about simultaneous physical gestures.
    const decks: BeadAction['deck'][] = to >= from ? ['upper','lower'] : ['lower','upper'];
    for (const deck of decks) {
      const current = Math.floor(value/place)%10;
      const different = deck === 'upper' ? (current >= 5) !== (to >= 5) : current%5 !== to%5;
      if (!different) continue;
      const bead = deck === 'upper' ? 0 : to%5 > current%5 ? to%5 - 1 : to%5;
      const step = makeStep(value,digits,{place,deck,bead});
      steps.push(step); value = step.after;
    }
  }
  if (value !== target) throw new Error('Ders adımları hedefe ulaşmıyor.');
  return steps;
}

function task(id: string, prompt: string, start: number, target: number, digits: number, rule: string, waypoints: number[]): TeachingTask {
  let value = start;
  const steps = waypoints.flatMap(next => { const moves = directSteps(value,next,digits); value = next; return moves; });
  if (value !== target || !steps.length) throw new Error('Eksik ders örneği.');
  return {id,prompt,start,target,digits,rule,steps};
}

function numberTask(value: number, digits = 1, clear = false) {
  return task(`number-${digits}-${value}-${clear ? 'clear' : 'set'}`,clear ? `${value} sayısını sıfırla.` : `${value} sayısını oluştur.`,
    clear ? value : 0,clear ? 0 : value,digits,
    clear ? 'Sıfırda bütün boncuklar orta çubuktan uzaktadır.' : 'Her basamağın değeri ayrı. Yalnızca orta çubuğa yakın boncuklar sayılır.',[clear ? 0 : value]);
}

function operation(kind: 'direct' | 'five' | 'ten', start: number, change: number): TeachingTask {
  const target = start + change, adding = change > 0, amount = Math.abs(change);
  const digits = kind === 'ten' ? 2 : 1;
  let waypoints = [target];
  let rule = 'Gereken boncuklar doğrudan hareket edebiliyor; tamamlama kullanma.';
  if (kind === 'five') {
    if (amount < 1 || amount > 4 || target < 0 || target > 9 || canChangeDirectly(start,target)) throw new Error('Beşe tamamlama örneği uygun değil.');
    waypoints = [start + (adding ? 5 : -5),target];
    rule = adding ? `+${amount} = +5 − ${5-amount}. Önce 5 ekle, sonra ${5-amount} çıkar.` :
      `−${amount} = −5 + ${5-amount}. Önce 5 çıkar, sonra ${5-amount} ekle.`;
  }
  if (kind === 'ten') {
    if (amount < 1 || amount > 9 || (adding ? start > 9 || target < 10 || target > 19 : start < 10 || start > 19 || target < 0 || target > 9)) throw new Error('Ona tamamlama örneği uygun değil.');
    waypoints = [start + (adding ? 10 : -10),target];
    rule = adding ? `+${amount} = +10 − ${10-amount}. Önce bir onluk ekle, sonra ${10-amount} çıkar.` :
      `−${amount} = −10 + ${10-amount}. Önce bir onluk çıkar, sonra ${10-amount} ekle.`;
  }
  return task(`${kind}-${start}-${change}`,`${start} ${adding ? '+' : '−'} ${amount}`,start,target,digits,rule,waypoints);
}

const ops = (kind: 'direct'|'five'|'ten', pairs: number[][]) => pairs.map(([a,b])=>operation(kind,a,b));

export const lessons: Lesson[] = [
  {
    id:'beads',title:'Boncukların dili',subtitle:'0–9 ve sıfırlama',goal:'Birlik ve beşlik boncukları kullanarak sayı oluştur.',
    ideas:['Orta çubuğa yaklaşan boncuklar sayıya katılır. Üstteki tek boncuk 5, alttaki her boncuk 1 değerindedir.',
      'Örneğin 7, bir üst ve iki alt boncukla gösterilir. Sıfır için bütün boncuklar çubuktan uzaklaşır.',
      'Ekranda bir alt boncuğa dokunduğunda aradaki boncuklar da onunla birlikte hareket eder. Tab ile boncuk seçip Enter veya boşluk tuşunu da kullanabilirsin.'],
    educatorNote:'Dijital tıklamalar fiziksel parmak tekniği değildir. Fiziksel 6–9 oluştururken üst ve alt boncukların birlikte hareketini eğitimci göstermelidir.',
    examples:[numberTask(3),numberTask(7),numberTask(7,1,true)],
    practice:[numberTask(2),numberTask(6),numberTask(9),numberTask(8,1,true),numberTask(4,1,true)],
  },
  {
    id:'places',title:'Basamakları yerleştir',subtitle:'Birler · onlar · yüzler',goal:'Aynı boncuğun farklı çubuklarda farklı değer taşıdığını gör.',
    ideas:['Bu ekranda en sağdaki çubuk birler, solundaki onlar, bir sonraki yüzler basamağıdır.',
      'Onlar çubuğundaki bir alt boncuk 10, üst boncuk 50 değerindedir. Yüzlerde değerler 100 ve 500 olur.',
      'Sayıyı soldan sağa kur. Arada sıfır varsa o çubuğu boş bırak; 106, bir yüzlük ve altı birliktir.'],
    educatorNote:'Bu pilot sağdaki çubuğu birler olarak sabitler. Gerçek sorobanda birim noktası ve çalışma alanı seçimi ayrıca gösterilmelidir.',
    examples:[numberTask(24,3),numberTask(106,3)],practice:[13,40,205,370,608].map(v=>numberTask(v,3)),
  },
  {
    id:'direct-add',title:'Doğrudan ekle',subtitle:'Tamamlamadan toplama',goal:'Uygun boncuklar varsa sayıyı doğrudan ekle.',
    ideas:['Sorobanda başlangıç sayısı hazır. Yalnızca eklenen sayı kadar boncuğu çubuğa yaklaştır.',
      'Önce alt boncuklarda yeterli yer olup olmadığını kontrol et. Üst boncuk gerekiyorsa onun boş olmasına bak.',
      'Bu dersteki işlemler boncuk değişimi veya onluk aktarma gerektirmez. Hedefimiz hız değil, doğru temsil.'],
    educatorNote:'Alt boncuk eklerken başparmak; üst boncuk için işaret parmağı kullanımı fiziksel gözlemle kontrol edilir.',
    examples:ops('direct',[[2,1],[6,2]]),practice:ops('direct',[[1,2],[5,3],[2,5],[7,1],[3,6]]),
  },
  {
    id:'direct-subtract',title:'Doğrudan çıkar',subtitle:'Çubuğu boşaltmayı öğren',goal:'Etkin boncukları uzaklaştırarak çıkarma yap.',
    ideas:['Çıkardığın miktarı temsil eden boncukları orta çubuktan uzaklaştır.',
      'Bir üst ve bir alt boncuğu kaldırmak, birler çubuğunda toplam 6 çıkarmaktır.',
      'Bu dersteki örneklerde gereken boncuklar zaten etkin. Henüz 5 veya 10 tamamlama kullanmıyoruz.'],
    educatorNote:'Alt ve üst boncukları kaldırırken işaret parmağı kullanımı kontrol edilir. Ekran yalnızca sayısal hareketi kaydeder.',
    examples:ops('direct',[[4,-2],[8,-6]]),practice:ops('direct',[[3,-1],[9,-2],[8,-5],[7,-6],[9,-9]]),
  },
  {
    id:'five-add',title:'5 ile köprü kur: ekle',subtitle:'Küçük tamamlayıcılar',goal:'Alt boncuklar yetmediğinde 5 ekleyip fazlayı geri al.',
    ideas:['5’i oluşturan eşler: 1 ve 4; 2 ve 3. Eklenecek sayının eşini düşün.',
      'Örneğin 4 üzerine 3 eklerken üç boş alt boncuk yok. 5 ekleyip 2 çıkararak aynı miktarı ekleyebilirsin.',
      'Önce üst boncuğu etkinleştir, sonra gereken alt boncukları uzaklaştır. Ara sayı, işlemin son cevabı değildir.'],
    educatorNote:'Bu bölüm yalnızca birler basamağında beşe tamamlama içerir. Daha karmaşık işlemlere otomatik seviye geçişi vermez.',
    examples:ops('five',[[4,3],[3,2]]),practice:ops('five',[[1,4],[2,3],[2,4],[3,3],[4,4]]),
  },
  {
    id:'five-subtract',title:'5 ile köprü kur: çıkar',subtitle:'Eksilttiğin fazlayı geri ekle',goal:'Alt boncuklar yetmediğinde 5 çıkarıp farkı geri ekle.',
    ideas:['Çıkarmak istediğin kadar etkin alt boncuk yoksa 5’lik boncuğu kullan.',
      'Örneğin 7’den 3 çıkarmak için önce 5 çıkar, sonra 2 ekle. Böylece net 3 çıkarmış olursun.',
      '5’in eşi yine aynı: 1–4 ve 2–3. Bu kez önce çıkarma, sonra ekleme var.'],
    educatorNote:'Aynı sonuca farklı yollardan varmak yanlış teknik kanıtı değildir. Bağımsız denemede örnek yol ile farklılık ayrıca raporlanır.',
    examples:ops('five',[[7,-3],[6,-4]]),practice:ops('five',[[5,-1],[5,-4],[6,-3],[7,-4],[8,-4]]),
  },
  {
    id:'ten-add',title:'10 ile köprü kur: ekle',subtitle:'Bir sonraki basamağa geç',goal:'Bir onluk ekleyerek tamamlayıcı miktarı geri çıkar.',
    ideas:['10’u oluşturan eşler: 1–9, 2–8, 3–7, 4–6, 5–5.',
      'Birler çubuğu 9’u aşamaz. Örneğin 8’e 4 eklemek için onlar çubuğuna bir onluk ekle, birlerden 6 çıkar.',
      'Bu pilotta önce onluk hareketini, sonra birlik düzeltmesini izliyoruz. Sadece tek onluk geçişi içeren örnekler seçildi.'],
    educatorNote:'İç içe 5–10 tamamlamaları, çoklu elde ve yüzlüklere aktarma bu dersin kapsamı dışında. Tek işlem sonucu bu tekniklerde ustalık sayılmaz.',
    examples:ops('ten',[[8,4],[9,3]]),practice:ops('ten',[[4,8],[6,4],[7,4],[8,3],[9,2]]),
  },
  {
    id:'ten-subtract',title:'10 ile köprü kur: çıkar',subtitle:'Bir onluğu çözümle',goal:'Bir onluk çıkarıp tamamlayıcı miktarı birliklere ekle.',
    ideas:['Birler basamağındaki sayı yetmediğinde bir onluk çıkarıp farkı geri ekleyebilirsin.',
      'Örneğin 13’ten 4 çıkarmak için önce 10 çıkar, sonra 6 ekle. Net değişim −4 olur.',
      'Basamak etiketlerini izlemeyi sürdür. Bu ders bittiğinde eğitimcinle gerçek sorobanda da aynı işlemleri çalış.'],
    educatorNote:'Pilot yalnızca tek onluk bozma örnekleri içerir. Eğitimci gözlemi, farklı günlerde tekrar ve içerik onayı olmadan seviye onayı verilmez.',
    examples:ops('ten',[[13,-4],[12,-8]]),practice:ops('ten',[[10,-6],[11,-3],[12,-4],[13,-9],[14,-5]]),
  },
];

function validTrace(task: TeachingTask, given: number, moves: BeadMove[]): boolean {
  let value = task.start;
  const valid = moves.every(move => {
    if (move.before !== value) return false;
    try { const after = applyBeadAction(value,task.digits,move); if (after !== move.after) return false; value = after; return true; } catch { return false; }
  });
  return valid && value === given;
}

export function evaluateLessonAnswer(task: TeachingTask, given: number, moves: BeadMove[], hintUsed: boolean): LessonAnswer {
  const correct = validTrace(task,given,moves) && given === task.target;
  return {
    taskId:task.id,given,correct,hintUsed,moves:[...moves],
    routeMatch:correct && moves.length === task.steps.length && moves.every((move,i)=>move.after === task.steps[i].after),
  };
}

export function guidanceForMove(expected: TeachingStep, actual: BeadMove): string {
  if (actual.place !== expected.action.place) return `Bu adım ${placeName(expected.action.place).toLocaleLowerCase('tr')} basamağında. Basamak etiketine yeniden bak.`;
  if (actual.deck !== expected.action.deck) return `Bu adımda ${expected.action.deck === 'upper' ? 'üstteki 5’lik boncuğu' : 'alttaki birlik boncukları'} kullanıyoruz.`;
  return 'Boncuk sayısını ve hareket yönünü yeniden kontrol et. Henüz sayı değişmedi.';
}

export function lessonSummary(record: LessonRecord) {
  return { total:record.answers.length,correct:record.answers.filter(a=>a.correct).length,
    withoutHint:record.answers.filter(a=>a.correct && !a.hintUsed).length,
    matchingRoutes:record.answers.filter(a=>a.routeMatch).length };
}

export function validateLessonRecord(value: unknown): value is LessonRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as LessonRecord, lesson = lessons.find(l=>l.id === r.lessonId);
  if (!lesson || typeof r.id !== 'string' || r.id.length > 100 || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at)) ||
      !Number.isInteger(r.guidedCorrections) || r.guidedCorrections < 0 || !Array.isArray(r.answers) || r.answers.length !== lesson.practice.length) return false;
  return r.answers.every((a,i)=> {
    if (!a || a.taskId !== lesson.practice[i].id || !Number.isInteger(a.given) || a.given < 0 || a.given >= 10 ** lesson.practice[i].digits || typeof a.hintUsed !== 'boolean' || !Array.isArray(a.moves) || a.moves.length > 500 || a.moves.some(m=>!m || typeof m !== 'object') || !validTrace(lesson.practice[i],a.given,a.moves)) return false;
    const checked = evaluateLessonAnswer(lesson.practice[i],a.given,a.moves,a.hintUsed);
    return a.correct === checked.correct && a.routeMatch === checked.routeMatch;
  });
}
