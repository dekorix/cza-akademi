const { test, expect } = require('@playwright/test');

const BASE=process.env.CZA_BASE_URL||'http://127.0.0.1:8787';
const STUDENT_ID='11111111-1111-4111-8111-111111111111';

async function mockStudents(page){
  await page.route('**/api/educator-students*',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,
      students:[{id:STUDENT_ID,name:'P2 Kabul Öğrencisi',code:'P2-QA',username:'p2qa'}],
      hasMore:false,
    })});
  });
}

async function verifyHub(page){
  await expect(page).toHaveURL(/\/assessment\/p2$/);
  await expect(page.getByRole('heading',{name:'1. sınıf sonu → 2. sınıf başlangıcı'})).toBeVisible();
  await expect(page.getByText('23 bölüm',{exact:true})).toBeVisible();
  await expect(page.getByText('226–239 görev',{exact:true})).toBeVisible();
  await expect(page.getByText('14 raporlama alanı',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tam P2 bölüm haritası'})).toBeVisible();
  await expect(page.getByText('Tanışma ve İlgi',{exact:true})).toBeVisible();
  await expect(page.getByText('Matematik Güç Taraması',{exact:true})).toBeVisible();
  await expect(page.getByText('Sesli Okuma ve Akıcılık',{exact:true})).toBeVisible();
  await expect(page.getByText('Manevi Farkındalık ve Değerler',{exact:true})).toBeVisible();
  await expect(page.getByText(/Gerçek öğrenci verisi/)).toBeVisible();
  const source=page.getByRole('link',{name:/Korunmuş tam kaynağı aç/});
  await expect(source).toHaveAttribute('href','https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/');
}

for(const device of [
  {name:'desktop',viewport:{width:1440,height:1000}},
  {name:'mobile',viewport:{width:390,height:844}},
]){
  test('P2 restoration entries and full contract '+device.name,async({page})=>{
    await page.setViewportSize(device.viewport);

    await page.goto(BASE+'/cza-degerlendirme/');
    await page.getByRole('button',{name:/1\.sınıf sonu \/ 2\.sınıf başlangıcı/}).click();
    await verifyHub(page);

    await mockStudents(page);
    await page.goto(BASE+'/educator/assessment');
    await page.locator('select').first().selectOption(STUDENT_ID);
    await page.getByRole('button',{name:/1\. sınıf sonu \/ 2\. sınıf başlangıcı/}).click();
    await expect(page.getByRole('button',{name:'Tam P2 restorasyon haritasını aç →'})).toBeVisible();
    await page.getByRole('button',{name:'Tam P2 restorasyon haritasını aç →'}).click();
    await verifyHub(page);
  });
}
