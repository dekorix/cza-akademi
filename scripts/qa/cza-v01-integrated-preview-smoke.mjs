// CZA-VERTICAL-01: unauthenticated, GET-only integrated preview smoke.
// NO cookies, tokens, student data, database write, or migration.
const origin=process.env.CZA_V01_PREVIEW_ORIGIN;
if(!origin)throw new Error('CZA_V01_PREVIEW_ORIGIN_MISSING');
const u=new URL(origin);
if(u.protocol!=='https:' || !/^[0-9a-f]{8}-cza-akademi-staging\.cza-staging-habip\.workers\.dev$/.test(u.hostname))
  throw new Error('CZA_V01_PREVIEW_HOST_NOT_ALLOWED');

const checks=[
  ['student-landing','/',200,'html'],
  ['work-center','/work',200,'html'],
  ['educator-panel','/educator',200,'html'],
  ['assessment-entry','/cza-degerlendirme/',200,'assessment'],
  ['assessment-js','/cza-degerlendirme/app.js',200,'js'],
  ['assessment-central-sync','/cza-degerlendirme/central-special-sync.js',200,'js'],
  ['assessment-dyslexia','/cza-degerlendirme/dyslexia-advanced.js',200,'js'],
  ['assessment-special-profiles','/cza-degerlendirme/special-profiles.js',200,'js'],
  ['student-dashboard-unauthorized','/api/core/dashboard',401,'api'],
  ['learning-profile-unauthorized','/api/core/learning-profile',401,'api'],
  ['educator-students-unauthorized','/api/educator-students',401,'api'],
  ['guardian-students-unauthorized','/api/guardian/students',401,'api'],
];

const result=[];
for(const [name,path,expected,type] of checks){
  let response;
  try{
    response=await fetch(new URL(path,u.origin),{
      method:'GET',redirect:'follow',credentials:'omit',
      headers:{'accept':type==='api'?'application/json':'text/html, */*'},
      signal:AbortSignal.timeout(15000),
    });
  }catch(error){
    console.error('CZA_V01_SMOKE_'+name+'=BLOCKED_NETWORK');
    result.push(false);continue;
  }
  let valid=response.status===expected&&new URL(response.url).hostname===u.hostname;
  if(valid&&type==='assessment'){
    const text=await response.text();
    valid=text.includes('CZA Değerlendirme Merkezi')&&text.includes('central-special-sync.js');
  }else if(valid&&type==='js'){
    const ct=(response.headers.get('content-type')||'').toLowerCase();
    const sample=(await response.text()).slice(0,1000).toLowerCase();
    valid=!ct.includes('text/html')&&!sample.includes('<!doctype html');
  }else if(valid&&type==='html'){
    valid=(response.headers.get('content-type')||'').toLowerCase().includes('text/html');
  }
  console.log('CZA_V01_SMOKE_'+name+'='+(valid?'PASS':'FAIL_'+response.status));
  result.push(valid);
}
console.log('CZA_V01_PUBLIC_AND_AUTH_SMOKE='+ (result.every(Boolean)?'PASS':'BLOCKED'));
console.log('CZA_V01_AUTHENTICATED_STUDENT_E2E=NOT_RUN');
console.log('CZA_V01_DB_MUTATION=NONE');
if(!result.every(Boolean))process.exitCode=2;
