export type V6Tier = 'core' | 'explore' | 'ceiling';
export type V6SectionId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

type TaskMeta = {
  id: string;
  section: V6SectionId;
  minAge: number;
  tier: V6Tier;
};

export const V6_SECTIONS = [
  { id: 'S1' as const, title: 'Temel Kavram, Eşleme ve Kategorizasyon' },
  { id: 'S2' as const, title: 'Alıcı Dil ve Kavramlar' },
  { id: 'S3' as const, title: 'Dikkat ve Görsel Bellek' },
  { id: 'S4' as const, title: 'Konuşma, Yer–Eylem ve İlişki' },
  { id: 'S5' as const, title: 'İşitsel Ayırt Etme ve Yansıma Sesler' },
  { id: 'S6' as const, title: 'Günlük Yaşam Eşleme ve İlişkilendirme' },
  { id: 'S7' as const, title: 'Bellek ve Çalışma Belleği' },
  { id: 'S8' as const, title: 'Dikkat ve Yürütücü İşlevler' },
];

const m = (id: string, section: V6SectionId, minAge = 24, tier: V6Tier = 'core'): TaskMeta => ({ id, section, minAge, tier });

export const V6_TASKS: TaskMeta[] = [
  m('E6S1_FIND_BALL','S1'),m('E6S1_MATCH_APPLE','S1'),m('E6S1_MATCH_CAR','S1'),m('E6S1_COLOR_MATCH','S1',24,'explore'),m('E6S1_SHAPE_MATCH','S1',24,'explore'),m('E6S1_BIG_SMALL','S1',24,'explore'),m('E6S1_SAME_DIFF','S1',27,'explore'),m('E6S1_CAT_ANIMAL','S1',30,'explore'),m('E6S1_FULL_EMPTY','S1',30,'explore'),m('E6S1_PROF_TOOL','S1',33,'ceiling'),
  m('E6S2_ACTION_SLEEP','S2'),m('E6S2_ACTION_EAT','S2'),m('E6S2_BODY2','S2'),m('E6S2_ONE_STEP','S2'),m('E6S2_GIVE_ME','S2'),m('E6S2_INSIDE','S2',27,'explore'),m('E6S2_ON','S2',27,'explore'),m('E6S2_COLOR_WORD','S2',30),m('E6S2_TWO_STEP','S2',30),m('E6S2_LONG_SHORT','S2',33,'ceiling'),
  m('E6S3_TARGET2','S3'),m('E6S3_MEMORY1','S3'),m('E6S3_HIDDEN_LOCATION','S3'),m('E6S3_SAME_TARGET','S3'),m('E6S3_TARGET3','S3',27,'explore'),m('E6S3_MEMORY2','S3',27,'explore'),m('E6S3_ODD','S3',30,'explore'),m('E6S3_SEARCH4','S3',30,'explore'),m('E6S3_MEMORY3','S3',33,'ceiling'),
  m('E6S4_OBJECT_NAME','S4'),m('E6S4_REQUEST','S4'),m('E6S4_GESTURE','S4'),m('E6S4_JOINT','S4'),m('E6S4_PLACE_BED','S4'),m('E6S4_PLACE_KITCHEN','S4',27,'explore'),m('E6S4_ACTION_NAME','S4',30),m('E6S4_DIALOG','S4',30),m('E6S4_BEFORE_AFTER','S4',30,'explore'),m('E6S4_CAUSE_RAIN','S4',33,'ceiling'),
  m('E6S5_CAT_SOUND','S5'),m('E6S5_DOG_SOUND','S5'),m('E6S5_CAR_SOUND','S5'),m('E6S5_BIRD_SOUND','S5'),m('E6S5_ANIMAL_IMITATE','S5'),m('E6S5_SOUND_DISCRIM','S5',27,'explore'),m('E6S5_VEHICLE_IMITATE','S5',27,'explore'),m('E6S5_AUDIO_SEQ','S5',30,'explore'),m('E6S5_SPEECH_SAMPLE','S5',30),
  m('E6S6_SPOON_FOOD','S6'),m('E6S6_SHOE_FOOT','S6'),m('E6S6_BED_SLEEP','S6'),m('E6S6_CUP_DRINK','S6'),m('E6S6_CAUSE_BUTTON','S6'),m('E6S6_TOOTHBRUSH_TEETH','S6',27,'explore'),m('E6S6_KITCHEN_OBJECT','S6',30,'explore'),m('E6S6_DAILY_SEQUENCE','S6',30,'explore'),m('E6S6_TRANSFER','S6',30),m('E6S6_DOCTOR_TOOL','S6',33,'ceiling'),
  m('E6S7_DELAYED_IMITATE','S7'),m('E6S7_HIDE_CUP','S7'),m('E6S7_VISUAL_ONE','S7'),m('E6S7_NEW_ACTION','S7'),m('E6S7_VISUAL_TWO','S7',27,'explore'),m('E6S7_TWO_STEP','S7',30),m('E6S7_RED_BLUE','S7',30,'explore'),m('E6S7_STORY2','S7',30,'explore'),m('E6S7_STORY3','S7',33,'ceiling'),
  m('E6S8_TARGET_SEARCH','S8'),m('E6S8_TRANSITION','S8'),m('E6S8_SUSTAIN','S8'),m('E6S8_GO_STOP','S8'),m('E6S8_FINE_BLOCK','S8'),m('E6S8_GROSS_BALL','S8'),m('E6S8_RECOVERY','S8'),m('E6S8_DISTRACTOR','S8',27,'explore'),m('E6S8_FREEZE','S8',27,'explore'),m('E6S8_SIMON2','S8',30,'explore'),m('E6S8_RULE_SWITCH','S8',33,'ceiling'),
];

const sectionDomains: Record<V6SectionId, string[]> = {
  S1: ['COG','VIS','RL'],
  S2: ['RL','ATT','MEM'],
  S3: ['ATT','MEM','VIS'],
  S4: ['EL','SPEECH','SC','JA','COG'],
  S5: ['RL','EL','SPEECH','ATT','IM'],
  S6: ['COG','RL','ADAPT'],
  S7: ['MEM','ATT','COG','IM'],
  S8: ['ATT','ADAPT','GROSS','FINE','SC','MEM'],
};

const sectionPrecursors: Record<V6SectionId, string[]> = {
  S1: ['MATCH','CLASS','CONCEPT'],
  S2: ['CONCEPT'],
  S3: [],
  S4: ['PROBLEM'],
  S5: [],
  S6: ['CLASS','PROBLEM','LEARNING'],
  S7: ['LEARNING','PATTERN'],
  S8: [],
};

export const v6ItemDomains: Record<string, string[]> = Object.fromEntries(V6_TASKS.map((task) => [task.id, sectionDomains[task.section]]));
export const v6PrecursorDomains: Record<string, string[]> = Object.fromEntries(V6_TASKS.filter((task) => sectionPrecursors[task.section].length > 0).map((task) => [task.id, sectionPrecursors[task.section]]));
export const v6NeutralProbeIds = new Set(V6_TASKS.filter((task) => task.tier === 'ceiling').map((task) => task.id));

export function v6RequiredIds(ageMonths?: number) {
  const age = Number.isFinite(ageMonths) ? Number(ageMonths) : 24;
  return V6_TASKS.filter((task) => age >= task.minAge).map((task) => task.id);
}

export function v6AgeBandLabel(ageMonths?: number) {
  const age = Number.isFinite(ageMonths) ? Number(ageMonths) : 24;
  if (age < 27) return '24–26 ay · temel bütüncül rota';
  if (age < 30) return '27–29 ay · genişleyen ilişki rotası';
  if (age < 33) return '30–32 ay · ileri bütüncül rota';
  return '33–35 ay · ileri rota + nötr tavan örneklemesi';
}

export function buildV6SectionProgress(ageMonths: number | undefined, responseIds: string[]) {
  const allowed = new Set(v6RequiredIds(ageMonths));
  const done = new Set(responseIds);
  return V6_SECTIONS.map((section) => {
    const tasks = V6_TASKS.filter((task) => task.section === section.id && allowed.has(task.id));
    const completed = tasks.filter((task) => done.has(task.id)).length;
    return {
      id: section.id,
      title: section.title,
      completed,
      total: tasks.length,
      ceiling: tasks.filter((task) => task.tier === 'ceiling').length,
      status: completed === tasks.length ? 'completed' : completed > 0 ? 'in_progress' : 'not_started',
    };
  });
}

