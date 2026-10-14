export const response={task:'T',raw:'5 onluk 2 birlik;4 onluk 12 birlik',kind:'production',channel:'production'};
export const observation={judgment:'RELATION_OBSERVED',criteria:{T1:'OBSERVED',T2:'OBSERVED',T3:'OBSERVED',T4:'OBSERVED',T5:'OBSERVED'},novelty:'UNSEEN',help:'NONE',history:'SYNTHETIC_HISTORY_REVIEW_01',historyKind:'SYNTHETIC_REVIEWED_LOG',note:'Sentetik gözlem; gerçek geçmiş/kimlik doğrulaması değil.'};
export const cases=[
 ...['INCORRECT_RELATION','PARTIAL_EVIDENCE','NOT_ASSESSED'].map(j=>({name:j,o:{judgment:j}})),
 ...['T1','T2','T3','T4','T5'].map(k=>({name:'missing '+k,o:{criteria:{...observation.criteria,[k]:'NOT_ASSESSED'}}})),
 {name:'unknown history ref',o:{history:'UNREVIEWED_REF'}},{name:'missing history',o:{history:''}},{name:'unverified history',o:{historyKind:'UNKNOWN'}},{name:'seen',o:{novelty:'SEEN'}},
 ...['PROMPT','MODEL'].map(help=>({name:help,o:{help}})),
 {name:'wrong number',r:{raw:'5 onluk 2 birlik;4 onluk 11 birlik'}},{name:'same representations',r:{raw:'5 onluk 2 birlik;5 onluk 2 birlik'}},
 {name:'no teacher',noTeacher:true},{name:'recognition',r:{kind:'recognition'}},{name:'menu construction',r:{channel:'objects'}},{name:'no grouping representation',r:{raw:'50+2;40+12'}}
];
