const { test, expect } = require('@playwright/test');

const BASE=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const STUDENT_ID='11111111-1111-4111-8111-111111111111';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

function caregiverPayload(answers){
  const questions=[
    {id:'CV4_MAIN_REASON',section:'1 · Gelişim Bağlamı ve Sağlık',label:'Bugün değerlendirmeye gelmenizin en önemli nedeni nedir?'},
    {id:'CV4_GOALS',section:'6 · Aile Hedefleri ve Eğitim Planı',label:'Önümüzdeki üç ayda değişmesini en çok istediğiniz üç somut beceri nedir?'},
  ];
  return {
    ok:true,
    questions,
    caregiver:{
      answered:Object.keys(answers).length,
      total:questions.length,
      completed:Object.keys(answers).length===questions.length,
      sections:[
        {title:'1 · Gelişim Bağlamı ve Sağlık',items:[{...questions[0],answer:answers.CV4_MAIN_REASON||'',note:''}]},
        {title:'6 · Aile Hedefleri ve Eğitim Planı',items:[{...questions[1],answer:answers.CV4_GOALS||'',note:''}]},
      ],
      redFlags:[],
      priorities:Object.values(answers).filter(Boolean),
    },
  };
}

async function installMocks(page){
  const state={configured:false,taskDone:false,childDone:false,caregiverDone:false,answers:{}};

  await page.route('**/api/educator-students*',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,students:[{id:STUDENT_ID,name:'E2 Merkez Öğrencisi',code:'E2-QA',username:'e2qa'}],hasMore:false,
    })});
  });

  await page.route('**/api/educator-assessment-context',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,
      student:{id:STUDENT_ID,name:'E2 Merkez Öğrencisi',birthDate:'2024-04-15',code:'E2-QA'},
      selection:{profileCode:'E2',purpose:'GENERAL'},
      target:{profileCode:'E2',status:'CENTRAL_READY',centralRoute:'/api/assessment-e2-linked',templateFamily:'CZA_E2_V7',requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'hazır'},
      canStartCentralAssessment:true,
    })});
  });

  await page.route('**/api/assessment-e2-linked',async route=>{
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({
      ok:true,session:{id:SESSION_ID,student_label:'E2 Merkez Öğrencisi'},student:{id:STUDENT_ID,name:'E2 Merkez Öğrencisi'},ageMonths:29,
    })});
  });

  await page.route('**/api/assessment-e2',async route=>{
    const body=route.request().postDataJSON();
    const action=body.action;
    if(action==='get'){
      const currentTask=state.configured&&!state.taskDone?{
        id:'E7_VIS_01',section:'VIS',kind:'choose',type:'match',title:'Aynısını bul',
        prompt:'Yukarıdakinin aynısını bul.',minAge:24,difficulty:1,tier:'core',
        sample:'🐱',options:['🐱','🚗'],correct:0,
      }:null;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        ok:true,
        session:{id:SESSION_ID,student_label:'E2 Merkez Öğrencisi',status:state.childDone&&state.caregiverDone?'completed':'active',metadata:{ageMonths:29,ageBand:'28–30 ay · ayırt etme ve ilişki rotası'}},
        profile:state.configured?{languageLevel:'two_word',interests:['animals'],attentionSpan:'medium'}:null,
        currentTask,sections:[{id:'VIS',title:'Görsel Eşleme ve Kategorizasyon'}],bankSize:138,
        responses:state.taskDone?[{itemId:'E7_VIS_01',rating:'independent'}]:[],
        summary:state.configured?{completedItems:state.taskDone?1:0,targetTotal:1,sectionProgress:[{id:'VIS',title:'Görsel Eşleme ve Kategorizasyon',completed:state.taskDone?1:0,total:1,status:state.taskDone?'completed':'in_progress'}]}:null,
        needsAdaptiveProfile:!state.configured,
        childPhaseComplete:state.childDone,
        caregiverRequired:true,
        caregiverComplete:state.caregiverDone,
        caregiverAnswered:Object.keys(state.answers).length,
        caregiverTotal:2,
      })});
    }
    if(action==='configure'){
      state.configured=true;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,currentTask:{id:'E7_VIS_01'},section:'VIS'})});
    }
    if(action==='attempt'){
      state.taskDone=true;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,nextTask:null,nextSection:null,childRouteComplete:true,sectionProgress:[]})});
    }
    if(action==='finish_child'){
      state.childDone=true;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,childCompletedAt:new Date().toISOString(),sessionCompleted:false})});
    }
    if(action==='caregiver_questions'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(caregiverPayload(state.answers))});
    }
    if(action==='caregiver_response'){
      state.answers[body.questionId]=body.answer;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(caregiverPayload(state.answers))});
    }
    if(action==='caregiver_finish'){
      state.caregiverDone=true;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sessionCompleted:true,caregiverCompletedAt:new Date().toISOString()})});
    }
    if(action==='report'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,report:{
        profileCode:'E2',studentLabel:'E2 Merkez Öğrencisi',ageMonths:29,ageBand:'28–30 ay · ayırt etme ve ilişki rotası',
        summary:{categoryPerformance:[{code:'VIS',title:'Görsel Eşleme ve Kategorizasyon',assessed:1,independentRate:100,supported:0}]},
        caregiver:{redFlags:[],priorities:['Dil ve oyun hedefi']},
        recommendations:['Farklı oyunlarda yeniden örnekle.'],
        interpretationNote:'Bu profil eğitimsel/gelişimsel gözlem aracıdır; klinik tanı değildir.',
      }})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'unexpected_action'})});
  });
}

async function runFlow(page){
  await installMocks(page);
  await page.goto(BASE+'/educator/assessment');
  await page.locator('select').first().selectOption(STUDENT_ID);
  await page.getByRole('button',{name:/24–36 ay · Erken Gelişim/}).click();
  await page.getByRole('button',{name:'Değerlendirme planını aç →'}).click();

  await expect(page).toHaveURL(/\/assessment\/e2\?session=/);
  await expect(page.getByRole('heading',{name:'E2 Merkez Öğrencisi'})).toBeVisible();

  await page.getByRole('button',{name:'Adaptif rotayı hazırla'}).click();
  await expect(page.getByRole('heading',{name:'Aynısını bul'})).toBeVisible();

  await page.getByRole('button',{name:'🐱'}).click();
  await page.getByRole('button',{name:'Kaydet ve adaptif göreve geç →'}).click();
  await expect(page.getByRole('heading',{name:'Çocukla doğrudan değerlendirme bölümü hazır.'})).toBeVisible();

  await page.getByRole('button',{name:'Çocuk bölümünü tamamla'}).click();
  await expect(page.getByText(/BAKIMVEREN GÖRÜŞMESİ/)).toBeVisible();

  await page.getByRole('button',{name:'Evet'}).click();
  await page.getByRole('button',{name:/Kaydet ve ilerle/}).click();
  await page.getByRole('button',{name:'Hayır'}).click();
  await page.getByRole('button',{name:/Kaydet ve ilerle/}).click();

  await expect(page.getByRole('button',{name:'Bakımveren görüşmesini tamamla ve raporu oluştur'})).toBeVisible();
  await page.getByRole('button',{name:'Bakımveren görüşmesini tamamla ve raporu oluştur'}).click();

  await expect(page.getByText('MERKEZİ CZA E2 RAPORU')).toBeVisible();
  await expect(page.getByText('%100')).toBeVisible();
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('central E2 full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    await runFlow(page);
  });
}
