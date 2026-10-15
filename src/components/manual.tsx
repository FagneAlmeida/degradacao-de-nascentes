import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Manual({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-card sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-canopy">Trabalho 20</p>
            <h2 id="manual-title" className="mt-1 text-2xl text-ink">
              Manual da demonstração
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium text-ink"
          >
            <X className="size-4" aria-hidden="true" />
            Fechar
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 text-sm leading-relaxed text-ink">
          <p>
            Os dois painéis recebem a mesma chuva ao mesmo tempo. A diferença é só a
            encosta: mata de um lado, solo desmatado do outro. Cada segundo da aula
            vale cerca de um minuto de chuva. Os números comparam os lados — não são
            milímetros medidos no campo.
          </p>

          <Section title="Comandos">
            <Item name="Soltar chuva">
              Liga e desliga a chuva. Clicar no céu de qualquer painel faz o mesmo.
            </Item>
            <Item name="Intensidade">
              Garoa, chuva moderada, chuva forte ou temporal. A intensidade vale para
              os dois lados juntos.
            </Item>
            <Item name="Criação animal e cultivo morro abaixo">
              Só mudam o painel de solo exposto. A mata continua protegida.
            </Item>
            <Item name="Recomeçar">
              Zera a chuva, os sulcos, o sedimento e as nascentes.
            </Item>
          </Section>

          <Section title="Painel com cobertura vegetal">
            <p>
              A copa segura o começo da chuva e amortece a gota. A água entra no solo,
              o lençol sobe e a nascente ganha vazão sem turvar.
            </p>
            <Rain>
              Na garoa e na chuva moderada, quase nada escorre. Na chuva forte, a mata
              ainda absorve a maior parte. Só um temporal chega a produzir um pouco de
              escoamento, com sedimento quase nulo. Quando a chuva para, a nascente
              continua: a água que infiltrou ainda alimenta o olho d'água.
            </Rain>
          </Section>

          <Section title="Painel de solo exposto">
            <p>
              Sem copa, a gota bate direto e sela a superfície. Forma-se uma crosta, os
              poros fecham e a chuva seguinte escorre em vez de infiltrar.
            </p>
            <Rain>
              Na garoa, parte da água ainda entra. Na chuva moderada, a crosta já
              fechou os poros: a enxurrada desce, arranca fragmentos e leva sedimento
              até a nascente. Na chuva forte e no temporal, o solo se parte, a água
              fica turva e a fonte assoreia. Quando a chuva para, a vazão cai — não
              houve recarga do lençol — e o barro permanece.
            </Rain>
            <Item name="Criação animal">
              O pisoteio compacta o solo. Infiltra menos, a enxurrada cresce e a
              sujeira do rebanho reduz a clareza da fonte.
            </Item>
            <Item name="Cultivo morro abaixo">
              O sulco vira caminho da água. O solo se fragmenta mais depressa e a
              nascente assoreia.
            </Item>
          </Section>

          <Section title="O que os números de cada painel medem">
            <Item name="Infiltração">
              Água que entrou no solo desde o início da chuva.
            </Item>
            <Item name="Escoamento">
              Água que desceu pela superfície, sem entrar no solo.
            </Item>
            <Item name="Sedimentos">
              Solo arrancado e carregado encosta abaixo.
            </Item>
            <Item name="Clareza e vazão">
              A cor do círculo é a água da nascente. Clareza baixa significa água
              imprópria para beber. Vazão alta e estável, depois da chuva, indica que
              o lençol está alimentando a fonte.
            </Item>
            <Item name="Porcentagem que escorreu">
              Quanto da chuva caída virou enxurrada naquele lado.
            </Item>
            <Item name="Frases sobre o desenho">
              "Copa molhada" é a mata amortecendo a gota. "Superfície
              selada" é a crosta do solo nu. "Nascente límpida" ou
              "turva" descreve a água que a comunidade usaria.
            </Item>
          </Section>

          <Section title="Gráficos">
            <p>
              A linha verde é a encosta com vegetação. A linha cor de barro é o solo
              exposto. "Vazão da nascente" mostra a força da fonte ao longo
              da chuva. "Sedimentos em transporte" mostra o solo que está
              descendo naquele momento — sobe no temporal do lado desmatado e fica
              perto de zero na mata.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-lg text-ink">{title}</h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Item({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-medium">{name}. </span>
      {children}
    </p>
  );
}

function Rain({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-paper px-3 py-3 text-muted">{children}</p>;
}
