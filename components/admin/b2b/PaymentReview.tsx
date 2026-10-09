"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAdmin } from "@/lib/admin-context";
import { hasFullPermission } from "@/components/admin/access/policy";
import { AdminApiError, adminRequest, errorText, istanbulDate } from "@/components/admin/operations/client";
import type { AdminMe } from "@/components/admin/access/types";
const path="/admin/finans/b2b";
const accessKey=(me:AdminMe|null)=>JSON.stringify([me?.admin.userId,me?.permissions]);
interface Row {id:string;orderId:string;quoteId:string|null;amount:number|string;currency:string;status:string;createdAt:string;reviewRequired:boolean;hold:boolean;released:boolean;linked:boolean}
interface Listing {items:Row[];hasMore:boolean}
const outcomes:Record<string,string>={released:"Doğrulanmış ret kaydedildi. Teklif yeniden ödeme denemesine açıldı.",paid:"Sağlayıcının doğrulanmış ödeme sonucu kaydedildi.",already_paid:"Ödeme zaten kaydedilmiş; ikinci kez uygulanmadı.",review:"Ödeme belirsiz veya çelişkili. İnceleme sürüyor; yeniden ödeme açılmadı.",closed:"Bu ödeme denemesi kapalı. Yeni işlem uygulanmadı."};
export default function PaymentReview(){
 const {me,denial,clearDenial}=useAdmin();
 useEffect(()=>()=>clearDenial(path),[clearDenial]);
 return <div className="p-4 md:p-8 space-y-5">
  <h1 className="text-2xl font-bold text-white">Kurumsal ödeme incelemeleri</h1>
  <p className="text-slate-300">Belirsiz ödeme, geçmiş deneme ve sağlayıcı sonucu takibi.</p>
  {denial?.scope===path&&<p role="alert" className="text-amber-200">{denial.message}</p>}
  <ReviewBody key={accessKey(me)}/>
 </div>;
}
function ReviewBody(){
 const {me,refresh,reportDenial}=useAdmin();
 const [data,setData]=useState<Listing|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [selected,setSelected]=useState<Row|null>(null),[action,setAction]=useState<"refresh"|"release">("refresh"),[evidence,setEvidence]=useState(""),[closed,setClosed]=useState(false);
 const [page,setPage]=useState(0);
 const noticeRef=useRef<HTMLParagraphElement>(null);
 const inFlight=useRef(false),alive=useRef(true),firstInput=useRef<HTMLTextAreaElement>(null),returnFocus=useRef<HTMLButtonElement|null>(null);
 const canRead=hasFullPermission(me,"finance.read");
 const canResolve=canRead&&hasFullPermission(me,"finance.b2b_payment.resolve");
 const deny=useCallback(async(e:unknown)=>{
  if(e instanceof AdminApiError&&e.status===403){
   setData(null);setSelected(null);
   if(e.code!=="mfa_required"){reportDenial({scope:path,message:errorText(e),keyOf:accessKey});await refresh();}
  }
 },[refresh,reportDenial]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!canRead)return;setLoading(true);setError("");
  try{const r=await adminRequest<Listing>(`/api/admin/b2b/payments?page=${page}`,undefined,signal);if(alive.current&&!signal?.aborted){setData(r.data);setUncertain(false);}}
  catch(e){if(alive.current&&!signal?.aborted){setData(null);setError(errorText(e));await deny(e);}}
  finally{if(alive.current&&!signal?.aborted)setLoading(false);}
 },[canRead,deny,page]);
 useEffect(()=>{alive.current=true;const c=new AbortController();void load(c.signal);return()=>{alive.current=false;c.abort();};},[load]);
 useEffect(()=>{if(selected)firstInput.current?.focus();},[selected]);
 useEffect(()=>{if(notice)noticeRef.current?.focus();},[notice]);
 const cancel=()=>{setSelected(null);setEvidence("");setClosed(false);requestAnimationFrame(()=>returnFocus.current?.focus());};
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!selected||inFlight.current||uncertain)return;
  inFlight.current=true;setBusy(true);setError("");setNotice("");
  try{
   const r=await adminRequest<{status:string}>(`/api/admin/b2b/payments/${selected.id}/resolve`,{action,evidence,sessionClosed:closed});
   if(!alive.current)return;setNotice(outcomes[r.data.status]??"Sonuç doğrulanamadı; görünümü yenileyin.");setSelected(null);setEvidence("");setClosed(false);await load();
  }catch(err){if(alive.current){setError(errorText(err));setUncertain(!(err instanceof AdminApiError)||err.status===0||err.status>=500||err.status===409);await deny(err);}}
  finally{inFlight.current=false;if(alive.current)setBusy(false);}
 }
 if(!canRead)return <p role="alert">Bu sayfaya erişiminiz yok. Tüm kayıtlar kapsamında finans okuma yetkisi gerekir.</p>;
 return <>
  <div className="flex flex-wrap gap-4 items-center">
   <button type="button" disabled={busy||loading} className="min-h-11 rounded border border-white/20 px-4 text-white disabled:opacity-50" onClick={()=>void load()}>Görünümü yenile</button>
   <Link href="/admin/guvenlik" className="min-h-11 inline-flex items-center text-emerald-300 underline">İki aşamalı doğrulama</Link>
  </div>
  <p className="text-sm text-slate-400">İşlemler için tüm kayıtlar kapsamında finans okuma ve kurumsal ödeme incelemesini sonuçlandırma yetkileri ile son 15 dakika içinde iki aşamalı doğrulama gerekir. Bu ekran para iadesi veya yeni tahsilat yapmaz.</p>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {notice&&<p ref={noticeRef} tabIndex={-1} role="status" className="text-emerald-200">{notice}</p>}
  {uncertain&&<p role="alert" className="text-amber-200">İşlem uygulanmış olabilir. Yeniden göndermeden önce görünümü yenileyin.</p>}
  {loading&&<p role="status">Kayıtlar yükleniyor…</p>}
  {data&&<div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy||loading||page===0} onClick={()=>{setSelected(null);setPage(p=>p-1);}} className="min-h-11 px-3 border border-white/20 rounded disabled:opacity-50">Önceki sayfa</button><span>Sayfa {page+1}</span><button type="button" disabled={busy||loading||!data.hasMore} onClick={()=>{setSelected(null);setPage(p=>p+1);}} className="min-h-11 px-3 border border-white/20 rounded disabled:opacity-50">Sonraki sayfa</button></div>}
  {data?.items.length===0&&<p>Kurumsal ödeme kaydı bulunamadı.</p>}
  <ul className="space-y-3">{data?.items.map(row=><li key={row.id} className="rounded-xl border border-white/15 p-4 space-y-2 break-words">
   <p className="font-medium text-white">{`${Number(row.amount).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} ${row.currency}`} · {istanbulDate(row.createdAt)}</p>
   <p className="text-xs text-slate-400 break-all">Ödeme: {row.id}</p>
   <p className="text-sm text-slate-300">{row.hold?"Çelişkili ödeme: finans bekletmesi":row.released?"Doğrulanmış ret; yeniden deneme açıldı":row.reviewRequired?"İnceleme gerekiyor":row.status==="success"?"Ödeme kaydedildi":row.status==="pending"?"Ödeme sonucu bekleniyor":"Kapalı ödeme denemesi"}{!row.linked&&" · Ödeme oturumu kaydı eksik"}</p>
   {canResolve&&<button type="button" disabled={busy||uncertain||loading} className="min-h-11 px-4 rounded border border-emerald-400/40 text-emerald-200 disabled:opacity-50" onClick={e=>{returnFocus.current=e.currentTarget;setSelected(row);setAction("refresh");setEvidence("");setClosed(false);setNotice("");}}>İncele</button>}
  </li>)}</ul>
  {selected&&<form onSubmit={submit} className="rounded-xl border border-emerald-400/40 p-4 space-y-4" aria-label="Ödeme inceleme işlemi">
   <h2 className="font-semibold text-white">Seçilen ödeme <span className="block text-xs break-all">{selected.id}</span></h2>
   <label className="block text-slate-200">İşlem<select aria-label="İşlem" value={action} disabled={busy||uncertain} onChange={e=>{setAction(e.target.value as "refresh"|"release");setClosed(false);}} className="block mt-2 min-h-11 w-full rounded bg-slate-900 border border-white/20 p-2"><option value="refresh">Sağlayıcıdan sorgula ve doğrulanmış sonucu kaydet</option><option value="release">Doğrulanmış ret sonrası yeniden deneme aç</option></select></label>
   <label className="block text-slate-200">Kanıt referansı<textarea ref={firstInput} required minLength={10} maxLength={500} value={evidence} disabled={busy||uncertain} onChange={e=>setEvidence(e.target.value)} className="block w-full mt-2 rounded bg-slate-900 border border-white/20 p-3" aria-describedby="evidence-help"/></label>
   <p id="evidence-help" className="text-sm text-slate-400">Sağlayıcı destek kaydı veya panel kontrol referansı. Kart bilgisi, kişisel veri ve gizli anahtar yazmayın.</p>
   {action==="release"&&<><p className="text-amber-200 text-sm">Yalnız açık ret sonucu yeterli değildir. Eski ödeme oturumunun yeniden tahsilat alamayacak şekilde kapandığını sağlayıcıdan doğrulayın. Zaman aşımı veya “ödeme bulunamadı” sonucu yeniden deneme açmaz.</p><label className="flex items-start gap-3 text-slate-200"><input type="checkbox" required checked={closed} disabled={busy||uncertain} onChange={e=>setClosed(e.target.checked)} className="mt-1 size-5"/>Eski oturumun kapandığını sağlayıcıdan doğruladım; kanıt referansını girdim.</label></>}
   <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy||uncertain||evidence.trim().length<10||(action==="release"&&!closed)} className="min-h-11 rounded bg-emerald-700 px-4 text-white disabled:opacity-50">{busy?"Doğrulanıyor…":"Sorgula ve uygula"}</button><button type="button" onClick={cancel} disabled={busy} className="min-h-11 rounded border border-white/20 px-4 text-white">Vazgeç</button></div>
  </form>}
 </>;
}
