import { Component, type ErrorInfo, type ReactNode } from 'react';
import CzaApp from './CzaApp';

class AssessmentErrorBoundary extends Component<{children:ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return {error:error.message||'Bilinmeyen ekran hatası'};}
  componentDidCatch(error:Error,info:ErrorInfo){
    try{sessionStorage.setItem('cza-last-screen-error',JSON.stringify({message:error.message,stack:error.stack,components:info.componentStack,route:location.hash,at:new Date().toISOString(),version:'wm-diagnostic-2'}));}catch{/* Storage may be unavailable. */}
  }
  render(){
    if(!this.state.error)return this.props.children;
    return <main style={{maxWidth:720,margin:'40px auto',padding:24,fontFamily:'system-ui',color:'#18372f'}} role="alert"><h1>Değerlendirme ekranında hata oluştu</h1><p>Bu ekran hatası kayıtlı cevaplarını silmez. Değerlendirme tamamlanmış sayılmadı.</p><p>Aşağıdaki hata bilgisinin ekran görüntüsünü gönder; aynı noktadaki sorunu inceleyelim.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#fff',padding:16}}>Sürüm: wm-diagnostic-2{'\n'}{this.state.error}</pre><button onClick={()=>location.reload()}>Kaydedilmiş bölümden yeniden aç</button><p>Bu bölümde henüz gönderilmemiş cevaplar yeniden istenebilir.</p></main>;
  }
}
function App(){return <AssessmentErrorBoundary><CzaApp/></AssessmentErrorBoundary>;}
export default App;
