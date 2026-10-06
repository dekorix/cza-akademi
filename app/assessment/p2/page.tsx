import {
  P2_FULL_MAX_TASKS,
  P2_FULL_MIN_TASKS,
  P2_FULL_REQUIRED_AREAS,
  P2_FULL_SECTIONS,
} from '@/lib/p2-full-assessment-contract';

const SOURCE_URL='https://cza-degerlendirme-hl4a5d.v2.appdeploy.ai/';

export default function P2AssessmentRestorationPage() {
  return (
    <main className="min-h-screen bg-[#f6faf8] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-[#d7e8df] bg-white shadow-sm">
          <div className="bg-[#18372f] px-6 py-8 text-white md:px-9">
            <p className="text-xs font-black tracking-[.16em] text-[#bfe8d3]">CZA · P2 TAM RESTORASYON</p>
            <h1 className="mt-3 text-3xl font-black md:text-5xl">1. sınıf sonu → 2. sınıf başlangıcı</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[#e5f4ed] md:text-base">
              Bu ekran dar merkezi değerlendirmeyi “tam P2” diye göstermeyi durdurur. Korunmuş gerçek kaynak
              23 bölüm, {P2_FULL_MIN_TASKS}–{P2_FULL_MAX_TASKS} mikro görev ve 14 ana raporlama alanından oluşur.
            </p>
          </div>

          <div className="grid gap-4 border-b border-[#e3eee8] bg-[#fffaf0] px-6 py-5 md:grid-cols-[1fr_auto] md:px-9">
            <div>
              <p className="font-bold text-[#694f19]">Merkezi taşıma tamamlanmadı</p>
              <p className="mt-1 text-sm leading-6 text-[#765f32]">
                Aşağıdaki AppDeploy uygulaması yalnız korunmuş kaynak/kabul referansıdır. Gerçek öğrenci verisi
                girmeyin. P2, tüm bölümler merkezi CZA kimliği ve kanıt katmanına taşınmadan CENTRAL_READY sayılmayacak.
              </p>
            </div>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#18372f] px-5 text-sm font-bold text-white"
            >
              Korunmuş tam kaynağı aç ↗
            </a>
          </div>

          <div className="grid gap-8 px-6 py-7 md:px-9">
            <div>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full bg-[#e7f5ed] px-4 py-2 text-sm font-bold text-[#226f60]">23 bölüm</span>
                <span className="rounded-full bg-[#e7f5ed] px-4 py-2 text-sm font-bold text-[#226f60]">{P2_FULL_MIN_TASKS}–{P2_FULL_MAX_TASKS} görev</span>
                <span className="rounded-full bg-[#e7f5ed] px-4 py-2 text-sm font-bold text-[#226f60]">14 raporlama alanı</span>
              </div>
            </div>

            <section>
              <h2 className="text-xl font-black text-[#18372f]">Tam P2 bölüm haritası</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {P2_FULL_SECTIONS.map((section,index)=>(
                  <article key={section.id} className="rounded-2xl border border-[#dce9e3] bg-[#fbfdfc] p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dff1e7] text-sm font-black text-[#226f60]">
                        {index+1}
                      </span>
                      <div>
                        <h3 className="font-bold text-[#18372f]">{section.title}</h3>
                        <p className="mt-1 text-xs text-[#6d8178]">{section.minTasks===section.maxTasks?section.minTasks:`${section.minTasks}–${section.maxTasks}`} görev · kaynak: {section.source}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-black text-[#18372f]">Korunacak 14 raporlama alanı</h2>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {P2_FULL_REQUIRED_AREAS.map((area,index)=>(
                  <div key={area} className="rounded-xl border border-[#e2ebe7] bg-white px-4 py-3 text-sm font-semibold text-[#34584e]">
                    <span className="mr-2 font-black text-[#226f60]">{index+1}.</span>{area}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
