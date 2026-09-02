import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastKind='success'|'error'|'info';
type Toast={id:number;message:string;kind:ToastKind};
type ConfirmOptions={title?:string;message:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean;inputLabel?:string;inputPlaceholder?:string;requireInput?:boolean};
type ConfirmState=ConfirmOptions&{resolve:(value:string|boolean|null)=>void};

type UiApi={toast:(message:string,kind?:ToastKind)=>void;confirm:(options:ConfirmOptions)=>Promise<boolean>;prompt:(options:ConfirmOptions)=>Promise<string|null>};
const UiContext=createContext<UiApi|null>(null);

export function UiProvider({children}:{children:ReactNode}){
 const [toasts,setToasts]=useState<Toast[]>([]); const [dialog,setDialog]=useState<ConfirmState|null>(null); const [input,setInput]=useState(''); const seq=useRef(0);
 const toast=useCallback((message:string,kind:ToastKind='success')=>{const id=++seq.current;setToasts(v=>[...v,{id,message,kind}]);window.setTimeout(()=>setToasts(v=>v.filter(t=>t.id!==id)),3800)},[]);
 const confirm=useCallback((options:ConfirmOptions)=>new Promise<boolean>(resolve=>{setInput('');setDialog({...options,resolve:(v)=>resolve(Boolean(v))})}),[]);
 const prompt=useCallback((options:ConfirmOptions)=>new Promise<string|null>(resolve=>{setInput('');setDialog({...options,inputLabel:options.inputLabel||'Motivo',resolve:(v)=>resolve(typeof v==='string'?v:null)})}),[]);
 function close(value:string|boolean|null){if(!dialog)return;dialog.resolve(value);setDialog(null);setInput('')}
 return <UiContext.Provider value={{toast,confirm,prompt}}>{children}
  <div className="toast-stack" aria-live="polite">{toasts.map(t=><div key={t.id} className={`toast toast-${t.kind}`}>{t.kind==='success'?<CheckCircle2/>:t.kind==='error'?<XCircle/>:<Info/>}<span>{t.message}</span><button onClick={()=>setToasts(v=>v.filter(x=>x.id!==t.id))} aria-label="Fechar aviso"><X size={16}/></button></div>)}</div>
  {dialog&&<div className="ui-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close(false)}}><div className="ui-dialog" role="dialog" aria-modal="true"><div className={`ui-dialog-icon ${dialog.danger?'danger':''}`}><AlertTriangle size={22}/></div><h3>{dialog.title||'Confirmar ação'}</h3><p>{dialog.message}</p>{dialog.inputLabel&&<label className="ui-dialog-field"><span>{dialog.inputLabel}</span><textarea autoFocus value={input} onChange={e=>setInput(e.target.value)} placeholder={dialog.inputPlaceholder||''}/></label>}<div className="ui-dialog-actions"><button className="secondary-btn" onClick={()=>close(dialog.inputLabel?null:false)}>{dialog.cancelLabel||'Cancelar'}</button><button className={dialog.danger?'danger-action-btn':'primary-btn'} disabled={Boolean(dialog.requireInput&&dialog.inputLabel&&!input.trim())} onClick={()=>close(dialog.inputLabel?input.trim():true)}>{dialog.confirmLabel||'Confirmar'}</button></div></div></div>}
 </UiContext.Provider>
}
export function useUi(){const ctx=useContext(UiContext);if(!ctx)throw new Error('useUi precisa estar dentro de UiProvider');return ctx}
