(function(root){
  'use strict';
  const esc=s=>String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const svg=(body,label='Görsel')=>`<svg class="task-svg" viewBox="0 0 220 160" role="img" aria-label="${esc(label)}"><rect x="2" y="2" width="216" height="156" rx="22" fill="#fbfdff" stroke="#cfdae3"/>${body}</svg>`;
  const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const rect=(x,y,w,h,c,rx=12)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"/>`;
  const choice=(html,i,correct,label)=>`<button class="svg-choice v3-stimulus-choice" data-choice="${i}" data-correct="${correct?'1':'0'}" aria-label="${esc(label)}">${html}</button>`;
  const row=(items,cls='')=>`<div class="v3-stimulus-row ${cls}">${items.join('')}</div>`;
  const ref=html=>`<div class="v3-stimulus-reference"><span>ÖRNEK</span>${html}</div>`;

  function dog(){return svg('<path d="M62 58 43 31c-8 23-4 40 9 50M158 58l19-27c8 23 4 40-9 50" fill="#b77b55"/>'+circle(110,82,47,'#d99a6c')+circle(91,75,5,'#17324d')+circle(129,75,5,'#17324d')+'<ellipse cx="110" cy="96" rx="22" ry="16" fill="#f4d7be"/>'+circle(110,91,6,'#17324d')+'<path d="M100 104q10 10 20 0" fill="none" stroke="#17324d" stroke-width="4" stroke-linecap="round"/>','Köpek')}
  function cat(){return svg('<path d="M68 62 75 31l24 20M152 62l-7-31-24 20" fill="#f2b38c"/>'+circle(110,84,44,'#f7c7a7')+circle(93,78,5,'#17324d')+circle(127,78,5,'#17324d')+'<path d="M105 91h10l-5 6z" fill="#c46f78"/><path d="M61 93h35M124 93h35M64 103h32M124 103h32" stroke="#7c5b54" stroke-width="3"/>','Kedi')}
  function car(missing=false){return svg(rect(48,75,124,45,'#4d7fe8',14)+'<path d="M72 75 91 48h49l22 27" fill="#7da6f2"/>'+(missing?'':circle(76,124,17,'#26384a'))+circle(146,124,17,'#26384a')+(missing?'':circle(76,124,8,'#dce8f2'))+circle(146,124,8,'#dce8f2'),'Araba')}
  function apple(){return svg('<path d="M112 52c-4-15 4-25 16-32" fill="none" stroke="#5b7b38" stroke-width="6" stroke-linecap="round"/><path d="M121 40c16-17 31-8 36 5-15 7-28 4-36-5" fill="#77a94a"/><path d="M110 58c36-21 67 9 55 48-10 30-35 38-55 25-20 13-45 5-55-25-12-39 19-69 55-48z" fill="#ef5c62"/>','Elma')}
  function banana(){return svg('<path d="M59 50c14 46 49 63 96 48-24 38-89 38-113-15-8-19-3-33 17-33z" fill="#f5cf48"/><path d="M61 49 53 37M156 97l10-5" stroke="#a97d22" stroke-width="6" stroke-linecap="round"/>','Muz')}
  function bike(){return svg('<circle cx="70" cy="108" r="32" fill="none" stroke="#46627c" stroke-width="7"/><circle cx="154" cy="108" r="32" fill="none" stroke="#46627c" stroke-width="7"/><path d="M70 108 97 65l22 43H70l44-30 40 30M97 65l-8-17H76M116 58h22" fill="none" stroke="#e56576" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>','Bisiklet')}
  function wheel(){return svg(circle(110,82,53,'#32485c')+circle(110,82,34,'#8ca2b5')+circle(110,82,10,'#f1f5f8')+'<path d="M110 48v68M76 82h68M86 58l48 48M134 58l-48 48" stroke="#eef4f8" stroke-width="5"/>','Tekerlek')}
  function ball(r=46,color='#5f8df2'){return svg(circle(110,82,r,color)+'<path d="M64 82h92M110 36v92" stroke="#dbe7ff" stroke-width="6" opacity=".8"/>','Top')}
  function shape(kind,color){let body='';if(kind==='circle')body=circle(110,82,48,color);if(kind==='square')body=rect(63,35,94,94,color,12);if(kind==='triangle')body=`<path d="M110 31 164 129H56z" fill="${color}"/>`;if(kind==='star')body=`<path d="M110 29 125 62 161 65 133 89 142 125 110 106 78 125 87 89 59 65 95 62z" fill="${color}"/>`;return svg(body,`${kind} şekli`)}
  function boxPosition(where){const y=where==='above'?42:where==='inside'?86:where==='below'?137:86;return svg(rect(68,66,84,58,'#f1c56c',6)+`<rect x="68" y="66" width="84" height="58" rx="6" fill="none" stroke="#b98c3c" stroke-width="5"/>`+circle(110,y,16,'#5f8df2'),`Top ${where}`)}
  function pair(a,b,label){return `<div class="v3-pair" aria-label="${esc(label)}">${a}${b}</div>`}
  function bowl(){return svg('<ellipse cx="110" cy="80" rx="63" ry="22" fill="#d6e5f2"/><path d="M47 80q9 60 63 60t63-60" fill="#7da6f2"/><ellipse cx="110" cy="80" rx="63" ry="22" fill="#eef5fb"/>','Kase')}
  function brush(){return svg(rect(92,35,36,82,'#d39455',14)+'<path d="M78 115h64l-8 26H86z" fill="#7a4f31"/>','Saç fırçası')}
  function head(){return svg(circle(110,82,49,'#f2c8a5')+'<path d="M63 77q5-54 47-54t47 54q-18-28-47-28T63 77z" fill="#4a382e"/>'+circle(93,84,4,'#17324d')+circle(127,84,4,'#17324d'),'Saç')}
  function spoon(){return svg('<ellipse cx="110" cy="51" rx="26" ry="35" fill="#a9bac7"/><rect x="104" y="82" width="12" height="60" rx="6" fill="#a9bac7"/>','Kaşık')}

  const renderers={
    'match-object':()=>`<div class="v3-stimulus-board">${ref(dog())}${row([choice(dog(),0,true,'Aynı köpek'),choice(car(),1,false,'Araba'),choice(apple(),2,false,'Elma')])}</div>`,
    'category-pairs':()=>`<div class="v3-stimulus-board">${row([choice(pair(dog(),cat(),'İki hayvan'),0,true,'İki hayvan'),choice(pair(cat(),car(),'Kedi ve araba'),1,false,'Kedi ve araba'),choice(pair(apple(),car(),'Elma ve araba'),2,false,'Elma ve araba')])}</div>`,
    'odd-one-out':()=>`<div class="v3-stimulus-board">${row([choice(apple(),0,false,'Elma'),choice(banana(),1,false,'Muz'),choice(bike(),2,true,'Bisiklet')])}</div>`,
    'size-contrast':()=>`<div class="v3-stimulus-board">${row([choice(ball(58),0,true,'Büyük top'),choice(ball(31),1,false,'Küçük top')],'two')}</div>`,
    'part-whole':()=>`<div class="v3-stimulus-board">${ref(wheel())}${row([choice(car(),0,true,'Araba'),choice(apple(),1,false,'Elma'),choice(cat(),2,false,'Kedi')])}</div>`,
    'spatial-position':()=>`<div class="v3-stimulus-board">${row([choice(boxPosition('inside'),0,false,'Kutunun içinde'),choice(boxPosition('above'),1,false,'Kutunun üstünde'),choice(boxPosition('below'),2,true,'Kutunun altında')])}</div>`,
    'dual-feature':()=>`<div class="v3-stimulus-board">${row([choice(shape('circle','#ef5c62'),0,true,'Kırmızı yuvarlak'),choice(shape('square','#ef5c62'),1,false,'Kırmızı kare'),choice(shape('circle','#4d7fe8'),2,false,'Mavi yuvarlak')])}</div>`,
    'analogy':()=>`<div class="v3-stimulus-board"><div class="v3-analogy-line">${pair(brush(),head(),'Fırça saça gider')}<span>→</span>${spoon()}<span>→ ?</span></div>${row([choice(bowl(),0,true,'Kase'),choice(bike(),1,false,'Bisiklet'),choice(apple(),2,false,'Elma')])}</div>`,
    'missing-part':()=>`<div class="v3-stimulus-board">${ref(car(true))}${row([choice(wheel(),0,true,'Tekerlek'),choice(apple(),1,false,'Elma'),choice(shape('triangle','#9c6ade'),2,false,'Üçgen')])}</div>`,
    'color-match':()=>`<div class="v3-stimulus-board">${ref(shape('star','#3fc59a'))}${row([choice(shape('square','#3fc59a'),0,true,'Aynı renk'),choice(shape('star','#4d7fe8'),1,false,'Farklı renk'),choice(shape('circle','#ef5c62'),2,false,'Farklı renk')])}</div>`,
    'shape-match':()=>`<div class="v3-stimulus-board">${ref(shape('triangle','#ef5c62'))}${row([choice(shape('triangle','#4d7fe8'),0,true,'Aynı şekil'),choice(shape('square','#ef5c62'),1,false,'Farklı şekil'),choice(shape('circle','#f2c761'),2,false,'Farklı şekil')])}</div>`
  };
  const api={supported:Object.keys(renderers),has:name=>!!renderers[name],render:name=>renderers[name]?renderers[name]():null};
  root.E3_STIMULI=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
