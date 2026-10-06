const { test, expect } = require('@playwright/test');
const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,accessCodes:['full_learning_37']}),
  }));
  await page.route('**/api/core',async route=>{
    if(route.request().method()!=='POST') return route.continue();
    const body=route.request().postDataJSON();
    if(body.action==='start'){
      captured.start=body;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sessionId:SESSION_ID})});
    }
    if(body.action==='module_record'){
      captured.record=body.record;
      captured.contract=route.request().headers()['x-cza-contract-version'];
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,learningRecordId:'33333333-3333-4333-8333-333333333333'})});
    }
    if(body.action==='finish'){
      captured.finish=body;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'unexpected_action'})});
  });
}

async function runStage(page,captured){
  await page.goto(BASE_URL+'/full-study');
  await expect(page.getByRole('heading',{name:'Tam Öğrenme Sistemi · 37 Adım'})).toBeVisible();
  await page.getByPlaceholder('Örnek: Su döngüsü, kesirler, fiiller...').fill('Su döngüsü');
  await page.getByRole('button',{name:/\/teachme.*Mini konu anlatımı/}).click();
  await expect(page.getByText('/teachme · 5/37')).toBeVisible();
  await page.getByPlaceholder('Bu aşamada ne ürettin?').fill('Su ısınınca buharlaşır, yükselir ve soğuyunca yoğunlaşır.');
  await page.getByText('Yeni örneğe uyguladım').click();
  await page.getByRole('button',{name:'Bu istasyonu tamamla'}).click();

  await expect(page.getByText('/teachme tamamlandı.')).toBeVisible();
  expect(captured.start.moduleCode).toBe('full_learning_37');
  expect(captured.start.settings.alias).toBe('/teachme');
  expect(captured.record.moduleId).toBe('full_learning_37');
  expect(captured.record.activityType).toBe('full_learning_teachme');
  expect(captured.record.metadata.rawEvidenceStored).toBe(false);
  expect(captured.record.metadata.superCommand).toBe('/fullstudy');
  expect(JSON.stringify(captured.record)).not.toContain('Su ısınınca buharlaşır');
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('full-learning 37 canonical stage flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await runStage(page,captured);
    await page.screenshot({path:'test-results/full-learning-37-'+device.name+'.png',fullPage:true});
  });
}
