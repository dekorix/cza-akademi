const { test, expect } = require('@playwright/test');

const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access', async route=>{
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({ok:true,accessCodes:['memory','attention_focus']}),
    });
  });
  await page.route('**/api/core', async route=>{
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

async function fullSelectiveFlow(page,captured){
  await page.goto(BASE_URL+'/attention');
  await expect(page.getByRole('heading',{name:'Hedefi gör. Kuralı koru. Dürtüyü yönet.'})).toBeVisible();
  await page.getByRole('button',{name:/Seçici Dikkat/}).click();
  await expect(page.getByRole('heading',{name:'Yalnız üçgenleri seç.'})).toBeVisible();

  for(const label of ['hücre 1 ▲','hücre 4 ▲','hücre 7 ▲','hücre 11 ▲']){
    await page.getByRole('button',{name:label}).click();
  }
  await page.getByRole('button',{name:'İlk turu tamamla'}).click();

  await expect(page.getByRole('heading',{name:'Şimdi yalnız kareleri seç.'})).toBeVisible();
  for(const label of ['hücre 2 ■','hücre 4 ■','hücre 7 ■','hücre 10 ■']){
    await page.getByRole('button',{name:label}).click();
  }
  await page.getByRole('button',{name:'Transferi tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  expect(captured.start.moduleCode).toBe('attention_focus');
  expect(captured.record.moduleId).toBe('attention_focus');
  expect(captured.record.activityType).toBe('attention_selective_attention');
  expect(captured.record.performance.firstAccuracy).toBe(1);
  expect(captured.record.performance.transferAccuracy).toBe(1);
  expect(captured.record.performance.falseAlarms).toBe(0);
  expect(captured.record.performance.omissions).toBe(0);
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('attention selective full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await fullSelectiveFlow(page,captured);
    await page.screenshot({path:'test-results/attention-'+device.name+'.png',fullPage:true});
  });
}
