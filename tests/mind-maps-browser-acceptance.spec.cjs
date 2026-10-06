const { test, expect } = require('@playwright/test');

const BASE_URL=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const SESSION_ID='22222222-2222-4222-8222-222222222222';

async function mockApi(page,captured){
  await page.route('**/api/core/access',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,accessCodes:['memory','attention_focus','speed_reading','mind_maps']})});
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

async function fullFlow(page,captured){
  await page.goto(BASE_URL+'/mind-maps');
  await expect(page.getByRole('heading',{name:'Bir merkez. Yedi dal. Net düşünce.'})).toBeVisible();
  await page.getByRole('button',{name:/Merkezden 7 Dala/}).click();

  const first=[
    ['dal 1 Amaç','enerji'],['dal 2 Yiyecek','yumurta'],['dal 3 İçecek','süt'],
    ['dal 4 Meyve','elma'],['dal 5 Zaman','sabah'],['dal 6 Yer','ev'],['dal 7 Alışkanlık','denge']
  ];
  for(const [label,value] of first) await page.getByLabel(label).selectOption(value);
  await page.getByRole('button',{name:'İlk 7 dalı tamamla'}).click();

  const transfer=[
    ['dal 1 Amaç','öğrenmek'],['dal 2 Yer','raflar'],['dal 3 Kişi','kütüphaneci'],
    ['dal 4 Araç','kitap'],['dal 5 Kural','sessizlik'],['dal 6 İşlem','seçmek'],['dal 7 Sonuç','bilgi']
  ];
  for(const [label,value] of transfer) await page.getByLabel(label).selectOption(value);
  await page.getByRole('button',{name:'Transfer haritasını tamamla'}).click();

  await expect(page.getByText('Oturum merkezi kayda işlendi')).toBeVisible();
  expect(captured.start.moduleCode).toBe('mind_maps');
  expect(captured.start.settings.branchCount).toBe(7);
  expect(captured.record.moduleId).toBe('mind_maps');
  expect(captured.record.metadata.branchCount).toBe(7);
  expect(captured.record.performance.transferAccuracy).toBe(1);
  expect(captured.contract).toBe('1.0.0');
  expect(captured.finish.sessionId).toBe(SESSION_ID);
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('mind maps full flow '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    const captured={};
    await mockApi(page,captured);
    await fullFlow(page,captured);
    await page.screenshot({path:'test-results/mind-maps-'+device.name+'.png',fullPage:true});
  });
}
