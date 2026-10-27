import { useGame } from '../store/gameStore';

interface Props { onDone?(): void }

/** Reinicia a campanha após confirmação. Só o mestre (o worker ignora os demais). */
export function ResetCampaignButton({ onDone }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm('Reiniciar a campanha? Todo o conteúdo atual será apagado.')) return;
        void useGame.getState().resetCampaign().then(onDone);
      }}
    >
      Reiniciar campanha
    </button>
  );
}
