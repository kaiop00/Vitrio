import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';

const COOLDOWN_SECONDS = 60;

function getCooldownKey(uid:string){
  return `vitrio:email-verification:last-sent:${uid}`;
}

function getRemainingCooldown(uid:string){
  const last=Number(localStorage.getItem(getCooldownKey(uid))||0);
  if(!last)return 0;

  return Math.max(
    0,
    COOLDOWN_SECONDS-Math.floor((Date.now()-last)/1000)
  );
}

function saveCooldown(uid:string){
  localStorage.setItem(
    getCooldownKey(uid),
    String(Date.now())
  );
}

function getVerificationErrorMessage(err:any){
  const code=String(err?.code||'').toLowerCase();
  const message=String(err?.message||'').toLowerCase();

  if(
    code.includes('too-many-requests') ||
    message.includes('too_many_attempts_try_later') ||
    message.includes('too many requests')
  ){
    return 'O Firebase bloqueou temporariamente novos envios por excesso de tentativas. Aguarde alguns minutos e tente novamente.';
  }

  if(
    code.includes('user-not-found') ||
    message.includes('user_not_found')
  ){
    return 'Não foi possível localizar esta conta. Saia e entre novamente no Vitrio.';
  }

  if(
    code.includes('invalid-id-token') ||
    message.includes('invalid_id_token')
  ){
    return 'Sua sessão expirou. Saia e entre novamente no Vitrio antes de reenviar.';
  }

  return 'Não foi possível enviar agora. Aguarde um pouco e tente novamente.';
}

export function VerifyEmailPage(){
  const {firebaseUser,profile}=useAuth();
  const navigate=useNavigate();

  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);
  const [cooldown,setCooldown]=useState(
    ()=>firebaseUser ? getRemainingCooldown(firebaseUser.uid) : 0
  );

  useEffect(()=>{
    if(!firebaseUser)return;

    setCooldown(getRemainingCooldown(firebaseUser.uid));

    const timer=window.setInterval(()=>{
      setCooldown(getRemainingCooldown(firebaseUser.uid));
    },1000);

    return ()=>window.clearInterval(timer);
  },[firebaseUser]);

  async function send(){
    if(!firebaseUser || loading)return;

    const remaining=getRemainingCooldown(firebaseUser.uid);

    if(remaining>0){
      setCooldown(remaining);
      setMsg(`Aguarde ${remaining}s antes de solicitar outro e-mail.`);
      return;
    }

    setLoading(true);
    setMsg('');

    try{
      auth.languageCode='pt-BR';

      await sendEmailVerification(firebaseUser);

      saveCooldown(firebaseUser.uid);
      setCooldown(COOLDOWN_SECONDS);

      setMsg(
        'E-mail de confirmação enviado em português. Verifique sua caixa de entrada e também a pasta Spam.'
      );

    }catch(err:any){

      console.error(
        '[VITRIO] Erro ao enviar verificação de e-mail:',
        {
          code: err?.code,
          message: err?.message,
          name: err?.name,
        }
      );

      saveCooldown(firebaseUser.uid);
      setCooldown(COOLDOWN_SECONDS);

      setMsg(getVerificationErrorMessage(err));

    }finally{
      setLoading(false);
    }
  }

  async function refresh(){
    if(!firebaseUser)return;

    await firebaseUser.reload();

    if(firebaseUser.emailVerified){
      navigate(
        profile?.role==='admin'
          ? '/admin'
          : '/painel',
        {replace:true}
      );
    }else{
      setMsg(
        'O e-mail ainda não foi confirmado. Depois de confirmar, clique novamente em “Já confirmei”.'
      );
    }
  }

  return (
    <div className="access-state">
      <div className="access-state-card">

        <div className="access-state-icon email">
          <Mail/>
        </div>

        <span className="status-chip">
          Verificação de e-mail
        </span>

        <h1>Confirme seu endereço de e-mail</h1>

        <p>
          Isso ajuda a proteger sua conta e permite recuperar o acesso com segurança.
        </p>

        {firebaseUser?.emailVerified ? (

          <div className="success-inline">
            <CheckCircle2/>
            E-mail já confirmado.
          </div>

        ) : (

          <div className="verify-actions">

            <button
              className="primary-btn"
              onClick={send}
              disabled={loading || cooldown>0}
            >
              {loading
                ? 'Enviando...'
                : cooldown>0
                  ? `Aguarde ${cooldown}s`
                  : 'Enviar e-mail de confirmação'
              }
            </button>

            <button
              className="secondary-btn"
              onClick={refresh}
            >
              <RefreshCw size={16}/>
              Já confirmei
            </button>

          </div>
        )}

        {msg && (
          <p className="muted">
            {msg}
          </p>
        )}

      </div>
    </div>
  );
}