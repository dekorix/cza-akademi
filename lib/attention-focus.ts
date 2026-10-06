export type AttentionMode='selective_attention'|'sustained_attention'|'inhibition'|'rule_switch';

export type AttentionActivity={
  code:AttentionMode;
  title:string;
  instruction:string;
  first:{items:string[];targets:string[];rule:string};
  transfer:{items:string[];targets:string[];rule:string};
};

export const attentionActivities:AttentionActivity[]=[
  {
    code:'selective_attention',
    title:'Seçici Dikkat',
    instruction:'Kalabalığın içinden yalnız hedef şekli bul.',
    first:{
      items:['▲','●','■','▲','◆','●','▲','■','●','◆','▲','●'],
      targets:['▲','▲','▲','▲'],
      rule:'Yalnız üçgenleri seç.',
    },
    transfer:{
      items:['◆','■','●','■','▲','◆','■','●','▲','■','◆','●'],
      targets:['■','■','■','■'],
      rule:'Şimdi yalnız kareleri seç.',
    },
  },
  {
    code:'sustained_attention',
    title:'Sürdürülen Dikkat',
    instruction:'Daha uzun taramada hedefi sonuna kadar kaçırmadan bul.',
    first:{
      items:['★','●','▲','■','★','◆','●','★','▲','■','◆','●','★','■','▲','◆'],
      targets:['★','★','★','★'],
      rule:'Bütün yıldızları bul.',
    },
    transfer:{
      items:['●','◆','■','▲','●','★','◆','●','■','▲','●','◆','★','●','■','▲'],
      targets:['●','●','●','●','●'],
      rule:'Bütün daireleri bul.',
    },
  },
  {
    code:'inhibition',
    title:'Ketleme',
    instruction:'Benzer uyaranlar arasından yalnız kurala uyanı seç, dürtüsel seçimi durdur.',
    first:{
      items:['🟢','🔴','🟢','🔴','🟡','🟢','🔴','🟡','🟢','🔴'],
      targets:['🟢','🟢','🟢','🟢'],
      rule:'Yalnız yeşil daireleri seç. Kırmızıya dokunma.',
    },
    transfer:{
      items:['🔵','🟡','🔵','🟢','🟡','🔵','🟢','🟡','🔵','🟢'],
      targets:['🔵','🔵','🔵','🔵'],
      rule:'Kural değişti: yalnız mavi daireleri seç.',
    },
  },
  {
    code:'rule_switch',
    title:'Kural Değiştirme',
    instruction:'İlk kuralı bırak ve yeni kurala hızla geç.',
    first:{
      items:['🔵■','🟡▲','🔵▲','🟡■','🔵■','🟡●','🔵●','🟡▲'],
      targets:['🔵■','🔵■'],
      rule:'Mavi kareleri seç.',
    },
    transfer:{
      items:['🟡▲','🔵■','🟡■','🔵▲','🟡▲','🔵●','🟡●','🔵■'],
      targets:['🟡▲','🟡▲'],
      rule:'Yeni kural: sarı üçgenleri seç.',
    },
  },
];

export type AttentionTrial={
  mode:AttentionMode;
  phase:'first'|'transfer';
  items:string[];
  targets:string[];
  selectedIndexes:number[];
  startedAt:number;
  completedAt:number;
  cueUsed:boolean;
};

export type AttentionTrialScore={
  hits:number;
  falseAlarms:number;
  omissions:number;
  correctRejects:number;
  targetCount:number;
  accuracy:number;
  latencyMs:number;
  meanSelectionLatencyMs:number;
  supportLevel:'independent'|'prompted';
};

export function scoreAttentionTrial(trial:AttentionTrial):AttentionTrialScore{
  const targetIndexes=new Set<number>();
  trial.items.forEach((item,index)=>{
    const remaining=[...trial.targets];
    if(remaining.includes(item)){
      const prior=[...targetIndexes].filter(i=>trial.items[i]===item).length;
      if(prior<trial.targets.filter(value=>value===item).length) targetIndexes.add(index);
    }
  });
  const selected=new Set(trial.selectedIndexes);
  let hits=0;
  let falseAlarms=0;
  let correctRejects=0;
  trial.items.forEach((_,index)=>{
    const isTarget=targetIndexes.has(index);
    const isSelected=selected.has(index);
    if(isTarget&&isSelected) hits+=1;
    else if(!isTarget&&isSelected) falseAlarms+=1;
    else if(!isTarget&&!isSelected) correctRejects+=1;
  });
  const omissions=Math.max(0,targetIndexes.size-hits);
  const total=Math.max(1,trial.items.length);
  const accuracy=Math.max(0,(hits+correctRejects)/total);
  const latencyMs=Math.max(0,Math.round(trial.completedAt-trial.startedAt));
  return {
    hits,
    falseAlarms,
    omissions,
    correctRejects,
    targetCount:targetIndexes.size,
    accuracy,
    latencyMs,
    meanSelectionLatencyMs:selected.size?Math.round(latencyMs/selected.size):latencyMs,
    supportLevel:trial.cueUsed?'prompted':'independent',
  };
}

export function attentionSessionSummary(input:{
  mode:AttentionMode;
  first:AttentionTrialScore;
  transfer:AttentionTrialScore;
}){
  const transferDelta=input.transfer.accuracy-input.first.accuracy;
  const falseAlarmTotal=input.first.falseAlarms+input.transfer.falseAlarms;
  const omissionTotal=input.first.omissions+input.transfer.omissions;
  const band=input.transfer.accuracy>=.9&&falseAlarmTotal===0&&omissionTotal<=1
    ?'STRONG_CONTROL'
    :input.transfer.accuracy>=.75
      ?'DEVELOPING'
      :'NEEDS_GUIDED_PRACTICE';
  return {
    mode:input.mode,
    firstAccuracy:Number(input.first.accuracy.toFixed(2)),
    transferAccuracy:Number(input.transfer.accuracy.toFixed(2)),
    transferDelta:Number(transferDelta.toFixed(2)),
    falseAlarmTotal,
    omissionTotal,
    band,
  } as const;
}

export function buildAttentionLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  mode:AttentionMode;
  startedAt:string;
  completedAt:string;
  first:AttentionTrialScore;
  transfer:AttentionTrialScore;
  cueUsed:boolean;
}){
  const summary=attentionSessionSummary({mode:input.mode,first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'attention_focus',
    moduleVersion:'1.0.0',
    activityType:'attention_'+input.mode,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:(input.cueUsed?'prompted':'independent') as 'prompted'|'independent',
    performance:{
      firstAccuracy:summary.firstAccuracy,
      transferAccuracy:summary.transferAccuracy,
      transferDelta:summary.transferDelta,
      falseAlarms:summary.falseAlarmTotal,
      omissions:summary.omissionTotal,
      firstMeanSelectionLatencyMs:input.first.meanSelectionLatencyMs,
      transferMeanSelectionLatencyMs:input.transfer.meanSelectionLatencyMs,
      band:summary.band,
    },
    skills:[
      'attention_control',
      input.mode,
      'rule_maintenance',
      'attention_transfer',
    ],
    metadata:{
      mode:input.mode,
      cueUsed:input.cueUsed,
      educationalOnly:true,
    },
  };
}
