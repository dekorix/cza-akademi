const { test, expect } = require('@playwright/test');
const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,accessCodes:['effective_notes']}),
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

async function completeFlow(page,captured){
  await page.goto(BASE_URL+'/effective-notes');
  await expect(page.getByRole('heading',{name:'Her şeyi yazma. İşe yarayanı yakala.'})).toBeVisible();
  await page.getByRole('button',{name:/Ana Fikri Süz/}).click();

  for(const option of ['Su doğada sürekli dolaşır','Buharlaşma ve yağış','Su yeniden yeryüzünde toplanır']){
    await page.getByRole('button',{name:option,exact:true}).click();
  }
  await page.getByPlaceholder('Örnek: ana fikir + 2-3 anahtar kelime...').fill('Su döngüsü, buharlaşma, yağış, yeniden toplanma.');
  await page.getByRole('button',{name:'İlk çalışmayı tamamla'}).click();

  for(const option of ['Bitkiler uygun koşullarda büyür','Köklerin su alması ve yaprakların besin üretmesi','Bitki gelişir']){
    await page.getByRole('button',{name:option,exact:true}).click();
  }
  await page.getByPlaceholder('Örnek: ana fikir + 2-3 anahtar kelime...').fill('Işık, su, kök, yaprak ve büyüme.');
  await page.getByRole('button',{name:'Transferi tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  expect(captured.start.moduleCode).toBe('effective_notes');
  expect(captured.record.moduleId).toBe('effective_notes');
  expect(captured.record.metadata.rawNoteStored).toBe(false);
  expect(JSON.stringify(captured.record)).not.toContain('Su döngüsü, buharlaşma');
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('effective notes full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await completeFlow(page,captured);
    await page.screenshot({path:'test-results/effective-notes-'+device.name+'.png',fullPage:true});
  });
}
