(function(root){
  'use strict';
  const bank=root.E3_BANK;if(!bank)throw new Error('E3_BANK must load first');
  const patches={
    MA02:{protocol:'Önünde en az dört aynı blok olsun; yalnız “bir tane” iste ve fazladan blok alırsa ilk tepkisini düzeltmeden kaydet.'}
  };
  for(const [id,patch] of Object.entries(patches)){
    const task=bank.allTasks.find(t=>t.id===id);
    if(!task)throw new Error(`Quality patch task not found: ${id}`);
    Object.assign(task,patch);
  }
  bank.meta.qualityPatch='E3-v3.2-quality';
})(typeof globalThis!=='undefined'?globalThis:this);
