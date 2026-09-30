import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

type Props = {
  publicKey: string;
  amount: number;
  payerEmail: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
};

export function MercadoPagoCardBrick({
  publicKey,
  amount,
  payerEmail,
  onSubmit,
  onCancel,
}: Props) {
  const controller = useRef<any>(null);
  const onSubmitRef = useRef(onSubmit);

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    let active = true;

    async function mountBrick() {
      try {
        setError('');
        setReady(false);

        if (!publicKey) {
          throw new Error(
            'A chave pública do Mercado Pago não está disponível.'
          );
        }

        if (!window.MercadoPago) {
          throw new Error(
            'O SDK do Mercado Pago não foi carregado.'
          );
        }

        try {
          await controller.current?.unmount?.();
        } catch {}

        const mp = new window.MercadoPago(publicKey, {
          locale: 'pt-BR',
        });

        const bricks = mp.bricks();

        controller.current = await bricks.create(
          'cardPayment',
          'mp-card-brick',
          {
            initialization: {
              amount: Number(amount),
              payer: {
                email: payerEmail,
              },
            },

            callbacks: {
              onReady: () => {
                if (!active) return;

                console.log(
                  '[Vitrio] Mercado Pago Card Brick carregado.'
                );

                setReady(true);
              },

              onError: (err: any) => {
                console.error(
                  '[Vitrio] Mercado Pago Card Brick:',
                  err
                );

                if (!active) return;

                setError(
                  err?.message ||
                    'Não foi possível carregar o formulário do cartão.'
                );
              },

              onSubmit: (formData: any) => {
                return new Promise<void>(
                  async (resolve, reject) => {
                    try {
                      await onSubmitRef.current(formData);
                      resolve();
                    } catch (err) {
                      console.error(
                        '[Vitrio] Erro ao processar cartão:',
                        err
                      );

                      reject(err);
                    }
                  }
                );
              },
            },
          }
        );
      } catch (err: any) {
        console.error(
          '[Vitrio] Erro ao iniciar Mercado Pago:',
          err
        );

        if (active) {
          setError(
            err?.message ||
              'Erro ao carregar pagamento com cartão.'
          );
        }
      }
    }

    mountBrick();

    return () => {
      active = false;

      try {
        controller.current?.unmount?.();
      } catch {}

      controller.current = null;
    };
  }, [publicKey, amount, payerEmail]);

  return (
    <div className="mp-card-wrap">
      <div className="mp-card-head">
        <div>
          <h3>Pagamento com cartão</h3>

          <p>
            Preencha os dados abaixo. O pagamento é processado
            com segurança pelo Mercado Pago.
          </p>
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={onCancel}
        >
          Voltar
        </button>
      </div>

      {!ready && !error && (
        <div className="integration-note">
          Carregando formulário seguro do Mercado Pago...
        </div>
      )}

      {error && (
        <div className="error checkout-error">
          {error}
        </div>
      )}

      <div
        id="mp-card-brick"
        style={{
          width: '100%',
          minHeight: 320,
        }}
      />
    </div>
  );
}
