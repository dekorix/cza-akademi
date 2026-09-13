import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=f=>fs.readFileSync(new URL(`./${f}`,import.meta.url),'utf8');
const index=read('index-v3.html');
const base=read('styles-v3.css');
const readable=read('readability-v3.css');
const institutional=read('institutional-v3.css');
const enhancer=read('institutional-v3.js');

for(const asset of ['styles-v3.css','readability-v3.css','institutional-v3.css','e3-bank-v3.js','e3-bank-v3-foundation.js','e3-bank-v3-depth.js','e3-bank-v3-quality.js','e3-engine-v3.js','app-v3.js','institutional-v3.js'])assert.ok(index.includes(asset),`index eksik: ${asset}`);
assert.ok(index.indexOf('e3-bank-v3-quality.js')<index.indexOf('e3-engine-v3.js'),'Kalite görev yamaları motor öncesi yüklenmeli');
assert.ok(index.indexOf('institutional-v3.js')>index.indexOf('app-v3.js'),'Kurumsal DOM katmanı uygulama sonrasında yüklenmeli');

assert.match(readable,/html,body\{font-size:16px\}/,'Temel punto 16px olmalı');
assert.match(readable,/button,input,select,textarea\{font-size:15px\}/,'Kontroller 15px tabanında olmalı');
assert.match(readable,/\.child-canvas>h2\{font-size:40px\}/,'Çocuk ana yönergesi masaüstünde güçlü olmalı');
assert.ok(readable.includes('@media(max-width:560px){.child-canvas>h2{font-size:28px}'),'Çocuk ana yönergesi mobilde 28px altına düşmemeli');
assert.ok(!readable.includes('font-size:9px'),'Okunabilirlik katmanında 9px metin olmamalı');
assert.ok(!readable.includes('font-size:10px'),'Okunabilirlik katmanında 10px metin olmamalı');
assert.ok(!readable.includes('font-size:11px'),'Okunabilirlik katmanında 11px metin olmamalı');

for(const token of ['border-width:1.5px','min-height:44px','button:focus-visible','.support-matrix,.flag-matrix','.domain-tile'])assert.ok(institutional.includes(token),`Kurumsal katman eksik: ${token}`);
assert.ok(enhancer.includes('bank.allTasks.length'),'Görev sayısı sabit metinden değil gerçek bankadan alınmalı');
assert.ok(enhancer.includes("aria-label','Eğitimci kanıt paneli"),'Eğitimci paneli erişilebilirlik etiketi eksik');
assert.ok(enhancer.includes("aria-label','Çocuk değerlendirme alanı"),'Çocuk alanı erişilebilirlik etiketi eksik');
assert.ok(base.includes('.domain-tile')&&base.includes('.evidence-console')&&base.includes('.child-canvas'),'Temel panel bileşenleri eksik');

console.log('E3_V3_UI_AUDIT_OK',JSON.stringify({baseFont:16,controlFont:15,childPromptDesktop:40,childPromptMobile:28,minActionHeight:44}));
