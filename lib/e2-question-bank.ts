export type V7SectionId = 'VIS' | 'CON' | 'REL' | 'PRO' | 'AUD' | 'MEM' | 'ATT' | 'NAT';
export type V7Tier = 'core' | 'explore' | 'ceiling';
export type V7Kind = 'choose' | 'memory' | 'audio' | 'language' | 'record' | 'inhibit' | 'observe';
export type V7Task = {
  id: string; section: V7SectionId; kind: V7Kind; type: string; title: string; prompt: string; minAge: number; difficulty: 1|2|3|4; tier: V7Tier; theme?: string;
  options?: string[]; correct?: number; sample?: string; cue?: string; spoken?: string; visual?: string; instruction?: string; material?: string; observe?: string; metrics?: string[];
};
export const V7_SECTIONS = [
  { id:'VIS' as const, icon:'🧩', title:'Görsel Eşleme ve Kategorizasyon', subtitle:'Aynısını bul → farklıyı ayırt et → kategoriye genelle → nötr tavan', bankCount:20 },
  { id:'CON' as const, icon:'↔️', title:'Kavramlar ve Karşılaştırma', subtitle:'Büyük-küçük, uzun-kısa, boş-dolu, konum, nicelik', bankCount:25 },
  { id:'REL' as const, icon:'🔗', title:'Yer–Eylem ve İlişkilendirme', subtitle:'Yer, eylem, nesne, neden ve günlük sıra', bankCount:20 },
  { id:'PRO' as const, icon:'🧑‍⚕️', title:'Meslek–Araç ve İşlev Keşfi', subtitle:'Yalnız uygun yaşta nötr ilişki keşfi', bankCount:15 },
  { id:'AUD' as const, icon:'🔊', title:'Yansıma Sesler ve İşitsel Ayırt Etme', subtitle:'Ses→görsel, görsel→ses ve ses taklidi', bankCount:15 },
  { id:'MEM' as const, icon:'🧠', title:'Hafıza ve Çalışma Belleği', subtitle:'Bak-sakla-hatırla, sıra ve iki adımlı bilgi', bankCount:20 },
  { id:'ATT' as const, icon:'🚦', title:'Dikkat ve Yürütücü İşlevler', subtitle:'Hedef bulma, çeldirici, git-dur ve kural değişimi', bankCount:15 },
  { id:'NAT' as const, icon:'🎈', title:'Doğal Dil, Oyun ve Transfer', subtitle:'Ekran dışı doğrulama: iletişim, oyun, motor ve öğrenme tepkisi', bankCount:8 },
];
const diffAge = (difficulty:number) => difficulty===1?24:difficulty===2?27:difficulty===3?30:33;
const tierFor = (difficulty:number, section:V7SectionId):V7Tier => difficulty===4||section==='PRO'?'ceiling':difficulty===1?'core':'explore';
const make = (id:string,section:V7SectionId,kind:V7Kind,type:string,title:string,prompt:string,difficulty:1|2|3|4,extra:Partial<V7Task>={}):V7Task => ({id,section,kind,type,title,prompt,difficulty,minAge:diffAge(difficulty),tier:tierFor(difficulty,section),...extra});
const pad=(n:number)=>String(n).padStart(2,'0');
const arrange=(correctOption:string,distractors:string[],position:number)=>{const options=[...distractors];const correct=Math.max(0,Math.min(position,options.length));options.splice(correct,0,correctOption);return{options,correct}};

const visualThemes=[
  {theme:'animals',a:'🐱',b:'🐶',c:'🐮',odd:'🚗',odd2:'🍎'},
  {theme:'vehicles',a:'🚗',b:'🚌',c:'🚚',odd:'🍎',odd2:'🐱'},
  {theme:'kitchen',a:'🍎',b:'🍌',c:'🍓',odd:'🚗',odd2:'🥄'},
  {theme:'kitchen',a:'🥄',b:'🍽️',c:'🥛',odd:'⚽',odd2:'🐶'},
  {theme:'outdoor',a:'🌳',b:'🌼',c:'🍃',odd:'🥄',odd2:'🚗'},
];
const vis:V7Task[]=[];visualThemes.forEach((t,i)=>{const b=i*4;vis.push(
  make(`E7_VIS_${pad(b+1)}`,'VIS','choose','match','Aynısını bul','Yukarıdakinin aynısını bul.',1,{theme:t.theme,sample:t.a,...arrange(t.a,[t.odd],i%2)}),
  make(`E7_VIS_${pad(b+2)}`,'VIS','choose','odd','Farklı olanı bul','İkisi aynı grupta. Farklı olanı göster.',2,{theme:t.theme,...arrange(t.odd,[t.a,t.b],(i+1)%3)}),
  make(`E7_VIS_${pad(b+3)}`,'VIS','choose','category','Aynı gruptan yeni olanı bul','Yukarıdaki ikisiyle aynı gruptan olan yeni resmi seç.',3,{theme:t.theme,sample:`text:${t.a}  ${t.b}`,...arrange(t.c,[t.odd,t.odd2],(i+2)%3)}),
  make(`E7_VIS_${pad(b+4)}`,'VIS','choose','exclude','Grubun dışında olanı bul','Üçü aynı grupta. Başka grupta olanı göster.',4,{theme:t.theme,...arrange(t.odd,[t.a,t.b,t.c],(i+3)%4)})
)});
const conceptDefs=[
  {key:'BIG',type:'size',title:'Büyük–küçük',pairs:[['size:circle:large','size:circle:small'],['size:square:large','size:square:small'],['size:circle:small','size:circle:large'],['size:square:small','size:square:large'],['size:circle:large','size:square:small']],prompts:['Büyük olanı göster.','Küçük olanı göster.','Büyük olanı göster.','Küçük olanı göster.','Daha büyük olanı seç.'],correct:[0,1,1,0,0]},
  {key:'LEN',type:'length',title:'Uzun–kısa',pairs:[['line:long','line:short'],['line:short','line:long'],['line:long','line:short'],['line:short','line:long'],['line:long','line:short']],prompts:['Uzun olanı göster.','Uzun olanı göster.','Kısa olanı göster.','Kısa olanı göster.','Daha uzun olanı seç.'],correct:[0,1,1,0,0]},
  {key:'FUL',type:'full_empty',title:'Dolu–boş',pairs:[['cup:full','cup:empty'],['cup:empty','cup:full'],['cup:full','cup:empty'],['cup:empty','cup:full'],['cup:full','cup:empty']],prompts:['Dolu olanı göster.','Dolu olanı göster.','Boş olanı göster.','Boş olanı göster.','Daha dolu olanı seç.'],correct:[0,1,1,0,0]},
  {key:'POS',type:'position',title:'İçinde–dışında',pairs:[['pos:inside','pos:outside'],['pos:outside','pos:inside'],['pos:on','pos:inside'],['pos:inside','pos:on'],['pos:outside','pos:on']],prompts:['İçinde olanı göster.','İçinde olanı göster.','Üstünde olanı göster.','Üstünde olanı göster.','Dışında olanı göster.'],correct:[0,1,0,1,0]},
  {key:'QTY',type:'quantity',title:'Bir–çok',pairs:[['group:⭐:1','group:⭐:3'],['group:⚽:4','group:⚽:1'],['group:🍎:1','group:🍎:4'],['group:🚗:4','group:🚗:1'],['group:🐱:1','group:🐱:4']],prompts:['Bir tane olanı göster.','Çok olanı göster.','Çok olanı göster.','Bir tane olanı göster.','Bir tane olanı göster.'],correct:[0,0,1,1,0]},
];
const con:V7Task[]=[];conceptDefs.forEach((c,ci)=>c.pairs.forEach((pair,vi)=>{const id=ci*5+vi+1;const difficulty=(vi===0?1:vi===1?1:vi===2?2:vi===3?3:4) as 1|2|3|4;con.push(make(`E7_CON_${pad(id)}`,'CON','choose',c.type,`${c.title} · ${vi+1}`,c.prompts[vi],difficulty,{options:pair,correct:c.correct[vi]}))}));
const relScenes=[
  {theme:'kitchen',place:'🍽️',action:'🍲',wrong:'😴',placeName:'Mutfakta',actionName:'yemek yeriz'},
  {theme:'outdoor',place:'🏞️',action:'⚽',wrong:'🛏️',placeName:'Parkta',actionName:'oynarız'},
  {theme:'outdoor',place:'🏊',action:'🏊',wrong:'🍽️',placeName:'Havuzda',actionName:'yüzeriz'},
  {theme:'kitchen',place:'🛏️',action:'😴',wrong:'⚽',placeName:'Yatakta',actionName:'uyuruz'},
  {theme:'kitchen',place:'🛁',action:'🧼',wrong:'🍎',placeName:'Banyoda',actionName:'yıkanırız'},
];
const rel:V7Task[]=[];relScenes.forEach((s,i)=>{const b=i*4;rel.push(
  make(`E7_REL_${pad(b+1)}`,'REL','choose','place_action','Yer → eylem',`${s.placeName} ne yapılır?`,1,{theme:s.theme,sample:s.place,options:[s.action,s.wrong],correct:0}),
  make(`E7_REL_${pad(b+2)}`,'REL','choose','action_place','Eylem → yer',`${s.actionName}. Hangi yer uygun?`,2,{theme:s.theme,sample:s.action,options:[s.place,'🏠','🚗'],correct:0}),
  make(`E7_REL_${pad(b+3)}`,'REL','choose','object_place','İlişkiyi tersine kur','Hangisi bu yerle birlikte olur?',3,{theme:s.theme,sample:s.place,options:[s.action,s.wrong,'🚗'],correct:0}),
  make(`E7_REL_${pad(b+4)}`,'REL','choose','cause_sequence','Neden / sıra keşfi','Bu olaydan önce hangisi olabilir?',4,{theme:s.theme,sample:s.action,options:[s.place,s.wrong,'🚗'],correct:0})
)});
const professions=[
  {p:'🧑‍⚕️',tool:'🩺',wrong:'🥄',action:'🩹',theme:'outdoor'},
  {p:'🧑‍🚒',tool:'🧯',wrong:'⚽',action:'🚒',theme:'vehicles'},
  {p:'🧑‍🍳',tool:'🥄',wrong:'🩺',action:'🍲',theme:'kitchen'},
  {p:'👷',tool:'🔨',wrong:'🪥',action:'🏠',theme:'outdoor'},
  {p:'🧑‍✈️',tool:'✈️',wrong:'🍳',action:'🛫',theme:'vehicles'},
];
const pro:V7Task[]=[];professions.forEach((p,i)=>{const b=i*3;pro.push(
  make(`E7_PRO_${pad(b+1)}`,'PRO','choose','profession_tool','Meslek → araç','Bu kişi hangisini kullanır?',1,{minAge:30,theme:p.theme,sample:p.p,options:[p.tool,p.wrong],correct:0}),
  make(`E7_PRO_${pad(b+2)}`,'PRO','choose','tool_profession','Araç → meslek','Bunu kim kullanır?',3,{minAge:33,theme:p.theme,sample:p.tool,options:[p.p,'🧒','🐱'],correct:0}),
  make(`E7_PRO_${pad(b+3)}`,'PRO','choose','profession_action','Meslek → işlev','Bu kişi ne yapar?',4,{minAge:33,theme:p.theme,sample:p.p,options:[p.action,p.wrong,'⚽'],correct:0})
)});
const sounds=[
  {theme:'animals',visual:'🐱',spoken:'Miyav',wrong:'🐶'},
  {theme:'animals',visual:'🐶',spoken:'Hav hav',wrong:'🐦'},
  {theme:'animals',visual:'🐦',spoken:'Cik cik',wrong:'🐱'},
  {theme:'vehicles',visual:'🚗',spoken:'Düt düt',wrong:'🚲'},
  {theme:'vehicles',visual:'🚂',spoken:'Çuf çuf',wrong:'🚗'},
];
const aud:V7Task[]=[];sounds.forEach((s,i)=>{const b=i*3;aud.push(
  make(`E7_AUD_${pad(b+1)}`,'AUD','audio','sound_visual','Ses → görsel','Sesi dinle, doğru resmi seç.',1,{theme:s.theme,spoken:s.spoken,options:[s.visual,s.wrong],correct:0}),
  make(`E7_AUD_${pad(b+2)}`,'AUD','choose','visual_sound','Görsel → ses','Bu ne ses çıkarır?',2,{theme:s.theme,sample:s.visual,options:[`text:${s.spoken}`,`text:${i%2?'Miyav':'Hav hav'}`],correct:0}),
  make(`E7_AUD_${pad(b+3)}`,'AUD','record','sound_production','Ses taklidi','Bu sesi sen de çıkar.',3,{theme:s.theme,visual:s.visual,spoken:s.spoken})
)});
const memorySets=[['🍎','🚗','🐶'],['⚽','🥄','🐱'],['🚗','🚌','🚚'],['🍓','🍌','🍎'],['🌳','🌼','⚽']];
const mem:V7Task[]=[];memorySets.forEach((set,i)=>{const b=i*4;mem.push(
  make(`E7_MEM_${pad(b+1)}`,'MEM','memory','single_memory','Tek görseli hatırla','Biraz önce hangisini gördün?',1,{cue:set[0],options:[set[0],set[1]],correct:0}),
  make(`E7_MEM_${pad(b+2)}`,'MEM','memory','pair_memory','İki görseli hatırla','Aynı ikiliyi seç.',2,{cue:`text:${set[0]}  ${set[1]}`,options:[`text:${set[0]}  ${set[1]}`,`text:${set[1]}  ${set[2]}`],correct:0}),
  make(`E7_MEM_${pad(b+3)}`,'MEM','memory','sequence_memory','Sırayı hatırla','Aynı sırayı seç.',3,{cue:`text:${set[0]}  ${set[1]}  ${set[2]}`,options:[`text:${set[0]}  ${set[1]}  ${set[2]}`,`text:${set[2]}  ${set[1]}  ${set[0]}`],correct:0}),
  make(`E7_MEM_${pad(b+4)}`,'MEM','memory','working_memory','Çalışma belleği keşfi','Önce gördüğün diziyi seç.',4,{cue:`text:${set[0]}  ${set[1]}  ${set[2]}`,options:[`text:${set[0]}  ${set[1]}  ${set[2]}`,`text:${set[0]}  ${set[2]}  ${set[1]}`],correct:0})
)});
const attentionTargets=[['⚽','🥄'],['🐱','🚗'],['🍎','⚽'],['🚗','🐶'],['🌼','🥄']];
const att:V7Task[]=[];attentionTargets.forEach((set,i)=>{const b=i*3;att.push(
  make(`E7_ATT_${pad(b+1)}`,'ATT','choose','target_search','Hedefi bul',`${set[0]} olanı bul.`,1,{options:[set[0],set[1]],correct:0}),
  make(`E7_ATT_${pad(b+2)}`,'ATT','choose','distractor_search','Çeldiriciler arasından bul',`${set[0]} olanı bul.`,2,{options:[set[1],set[0],set[1]],correct:1}),
  make(`E7_ATT_${pad(b+3)}`,'ATT','inhibit','go_stop','Dokun–bekle oyunu',`${set[0]} görünce dokun; ${set[1]} görünce bekle.`,3,{sample:`text:${set[0]} = DOKUN · ${set[1]} = BEKLE`,options:[set[0],set[1]],correct:0})
)});
const nat:V7Task[]=[
  make('E7_NAT_01','NAT','observe','joint_attention','Ortak dikkat','İlgi çekici oyuncağı birlikte inceleyin.',1,{instruction:'Çocuğun nesne ile yetişkin arasında dikkati kendiliğinden paylaşmasını bekleyin.',material:'Tercih edilen oyuncak',observe:'Bakış/dikkat geçişi ve paylaşma girişimi.'}),
  make('E7_NAT_02','NAT','observe','request','Kendiliğinden iletişim','Tercih edilen nesneyi görünür fakat erişimi sınırlı sunun.',1,{instruction:'Kısa süre sessizce bekleyin.',material:'Tercih edilen oyuncak',observe:'Bakış, jest, ses veya sözcükle iletişim başlatma.'}),
  make('E7_NAT_03','NAT','language','language_sample','Doğal dil örneklemi','5–8 dakikalık doğal oyunda iletişim örneklerini kaydedin.',1,{visual:'💬',observe:'Sözcük, sözcük birleşimi, işlev ve anlaşılabilirlik.',metrics:['Kendiliğinden girişim','İstek','Yorum','İki+ sözcüklü ifade','Anlaşılır üretim']}),
  make('E7_NAT_04','NAT','observe','functional_play','İşlevsel oyun','Tanıdık oyuncaklarla serbest oyun fırsatı verin.',1,{instruction:'Yönlendirmeden kısa süre bekleyin.',material:'Araba, fincan, kaşık gibi oyuncaklar',observe:'Nesneleri amacına uygun kullanma ve oyunu sürdürme.'}),
  make('E7_NAT_05','NAT','observe','imitation','Taklit ve modelden öğrenme','Bir motor hareket ve nesne kullanımını modelleyin.',2,{instruction:'Çocuğun aynı modeli kopyalamasını bekleyin.',material:'Basit oyuncak',observe:'Modelden öğrenme ve tekrar.'}),
  make('E7_NAT_06','NAT','observe','problem','Gerçek nesneyle problem çözme','Oyuncağa ulaşmak için güvenli, basit bir engel oluşturun.',2,{instruction:'Çocuğun deneme ve strateji değiştirmesini gözleyin.',material:'Oyuncak + kolay engel',observe:'Deneme, araç kullanma ve yardım sonrası öğrenme.'}),
  make('E7_NAT_07','NAT','observe','pretend','Mış gibi oyun','Günlük yaşam oyuncaklarıyla mış gibi oyuna fırsat verin.',3,{instruction:'Bebek/fincan/kaşıkla serbest oyun sunun.',material:'Sembolik oyun materyali',observe:'Sembolik kullanım ve iki eylemi bağlama.'}),
  make('E7_NAT_08','NAT','observe','transfer','Transfer doğrulaması','Daha önce öğrendiği basit bir eşleme kuralını yeni materyale taşımasını isteyin.',3,{instruction:'Önce bir örnek modelleyin, sonra farklı örneği bağımsız bırakın.',material:'İki farklı renk/nesne seti',observe:'Öğrenilen kuralı yeni materyale transfer etme.'}),
];
export const V7_TASKS:V7Task[]=[...vis,...con,...rel,...pro,...aud,...mem,...att,...nat];
export const V7_TASK_MAP=new Map(V7_TASKS.map(task=>[task.id,task]));
export const V7_BANK_SIZE=vis.length+con.length+rel.length+pro.length+aud.length+mem.length+att.length;
