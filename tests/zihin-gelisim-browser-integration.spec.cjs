const { test, expect } = require('@playwright/test');

const BASE=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const accessCodes=['memory','attention_focus','speed_reading','mind_maps','intelligence_games','effective_notes','full_learning_37'];
const routes=[
  ['/memory','Ezberleme. Bir yöntem kullan.'],
  ['/attention','Hedefi gör. Kuralı koru. Dürtüyü yönet.'],
  ['/speed-reading','Hızlanırken anlamı yanında tut.'],
  ['/mind-maps','Bir merkez. Yedi dal. Net düşünce.'],
  ['/intelligence-games','Kuralı bul. Çözümü dene. Yeni probleme taşı.'],
  ['/effective-notes','Her şeyi yazma. İşe yarayanı yakala.'],
  ['/full-study','Tam Öğrenme Sistemi · 37 Adım'],
];

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('7/7 Zihin Gelişim route smoke '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);
    await page.route('**/api/core/access',async route=>{
      await route.fulfill({
        status:200,
        contentType:'application/json',
        body:JSON.stringify({ok:true,package:{package_code:'ZIHIN_GELISIM'},accessCodes}),
      });
    });

    for(const [path,heading] of routes){
      await page.goto(BASE+path);
      await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
      await expect(page.getByText(/henüz hesabında açık değil/)).toHaveCount(0);
    }
  });
}
