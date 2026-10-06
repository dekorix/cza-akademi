const { test, expect } = require('@playwright/test');

const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access', async route=>{
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({ok:true,accessCodes:['memory','attention_focus','speed_reading']}),
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

async function fullPhraseFlow(page,captured){
  await page.goto(BASE_URL+'/speed-reading');
  await expect(page.getByRole('heading',{name:'Hızlanırken anlamı yanında tut.'})).toBeVisible();
  await page.getByRole('button',{name:/Kelime Gruplarıyla Okuma/}).click();
  await expect(page.getByRole('heading',{name:'Bahçedeki Sabah'})).toBeVisible();
  await page.getByRole('button',{name:'Metni okudum'}).click();

  await page.getByRole('button',{name:'Gülleri suladı'}).click();
  await page.getByRole('button',{name:'Kuşları dinledi'}).click();
  await page.getByRole('button',{name:'İlk metni tamamla'}).click();

  await expect(page.getByRole('heading',{name:'Kütüphane Günü'})).toBeVisible();
  await page.getByRole('button',{name:'Metni okudum'}).click();
  await page.getByRole('button',{name:'Uzay'}).click();
  await page.getByRole('button',{name:'İki bilgi not etti'}).click();
  await page.getByRole('button',{name:'Transferi tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  expect(captured.start.moduleCode).toBe('speed_reading');
  expect(captured.record.moduleId).toBe('speed_reading');
  expect(captured.record.activityType).toBe('speed_reading_phrase_chunking');
  expect(captured.record.performance.firstComprehension).toBe(1);
  expect(captured.record.performance.transferComprehension).toBe(1);
  expect(captured.record.metadata.normReferenced).toBe(false);
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('speed reading full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await fullPhraseFlow(page,captured);
    await page.screenshot({path:'test-results/speed-reading-'+device.name+'.png',fullPage:true});
  });
}
