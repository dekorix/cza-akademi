const { test, expect } = require('@playwright/test');

const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,accessCodes:['memory','attention_focus','speed_reading','mind_maps','intelligence_games']})});
  });
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

async function flow(page,captured){
  await page.goto(BASE_URL+'/intelligence-games');
  await expect(page.getByRole('heading',{name:'Kuralı bul. Çözümü dene. Yeni probleme taşı.'})).toBeVisible();
  await page.getByRole('button',{name:/Örüntü Avcısı/}).click();

  { const sets=page.locator('fieldset'); await sets.nth(0).getByRole('button',{name:'10',exact:true}).click(); await sets.nth(1).getByRole('button',{name:'●',exact:true}).click(); await sets.nth(2).getByRole('button',{name:'16',exact:true}).click(); }
  await page.getByRole('button',{name:'İlk seti tamamla'}).click();

  { const sets=page.locator('fieldset'); await sets.nth(0).getByRole('button',{name:'25',exact:true}).click(); await sets.nth(1).getByRole('button',{name:'■',exact:true}).click(); await sets.nth(2).getByRole('button',{name:'48',exact:true}).click(); }
  await page.getByRole('button',{name:'Transfer setini tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  expect(captured.start.moduleCode).toBe('intelligence_games');
  expect(captured.record.moduleId).toBe('intelligence_games');
  expect(captured.record.performance.transferAccuracy).toBe(1);
  expect(captured.record.metadata.iqEquivalent).toBe(false);
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('intelligence games full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await flow(page,captured);
    await page.screenshot({path:'test-results/intelligence-'+device.name+'.png',fullPage:true});
  });
}
