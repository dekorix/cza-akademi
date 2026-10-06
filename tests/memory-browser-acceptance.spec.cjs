const { test, expect } = require('@playwright/test');

const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockMemoryApi(page, captured){
  await page.route('**/api/core/access', async route=>{
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({ok:true,package:{package_code:'ZIHIN_GELISIM'},accessCodes:['memory']}),
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
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,learningRecordId:'33333333-3333-4333-8333-333333333333',replayed:false})});
    }
    if(body.action==='finish'){
      captured.finish=body;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'unexpected_action'})});
  });
}

async function completeVisualLink(page,captured){
  await page.goto('/memory');
  await expect(page.getByRole('heading',{name:'Ezberleme. Bir yöntem kullan.'})).toBeVisible();
  await page.getByRole('button',{name:/Görsel Bağ/}).click();
  await expect(page.getByText('balon',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hazırım, kelimeleri gizle'}).click();

  for(const item of ['balon','kitap','limon','anahtar','şapka']){
    await page.getByRole('button',{name:item,exact:true}).click();
  }
  await page.getByRole('button',{name:'İlk denemeyi tamamla'}).click();

  await expect(page.getByText('uçurtma',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hazırım, kelimeleri gizle'}).click();
  for(const item of ['uçurtma','kaşık','çiçek','saat','tren']){
    await page.getByRole('button',{name:item,exact:true}).click();
  }
  await page.getByRole('button',{name:'Transferi tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  await expect(page.getByText('5/5',{exact:true}).first()).toBeVisible();
  expect(captured.start.moduleCode).toBe('memory');
  expect(captured.record.moduleId).toBe('memory');
  expect(captured.record.activityType).toBe('memory_visual_link');
  expect(captured.record.performance.firstAccuracy).toBe(1);
  expect(captured.record.performance.transferAccuracy).toBe(1);
  expect(captured.record.skills).toContain('memory_transfer');
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('memory visual-link full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockMemoryApi(page,captured);
    await completeVisualLink(page,captured);
    await page.screenshot({path:'test-results/memory-'+device.name+'.png',fullPage:true});
  });
}
