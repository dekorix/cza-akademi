async function request(method:string,path:string,body?:unknown){
 const studentId=new URLSearchParams(location.search).get('studentId');
 if(studentId)path+=(path.includes('?')?'&':'?')+'studentId='+encodeURIComponent(studentId);
 const response=await fetch(path.replace(/^\/api\//, '/api/p2-original/'),{method,credentials:'same-origin',headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(!response.ok){const failure=new Error(data?.message||data?.error||'İşlem tamamlanamadı');Object.assign(failure,{response:{status:response.status,data}});throw failure;}return{data,status:response.status};
}
export const api={get:(p:string)=>request('GET',p),post:(p:string,b?:unknown)=>request('POST',p,b),put:(p:string,b?:unknown)=>request('PUT',p,b)};
