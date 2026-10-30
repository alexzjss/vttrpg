import { describe, expect, it } from 'vitest';
import {
  calculateDefenseDamage,
  calculateHealthDamage,
  calculateStaggerDamage,
  defaultDefense,
  defaultStagger,
  type Defense,
  type Stagger,
  isDefenseActive,
  processDefenseRound,
  processStaggeredTurn,
  recoverStagger,
  regenerateDefense,
  resolveDefenseHit,
  STAGGER_EXIT_RATIO,
} from './defense';

const defense = (over: Partial<Defense> = {}): Defense => ({
  armor: 10,
  max: 20,
  current: 20,
  reduction: 0.3,
  regeneration: 4,
  activationThreshold: 0.2,
  broken: false,
  ...over,
});

const stagger = (over: Partial<Stagger> = {}): Stagger => ({
  max: 100,
  current: 0,
  recovery: 15,
  damageMultiplier: 1.4,
  duration: 1,
  staggered: false,
  turnsRemaining: 0,
  ...over,
});

describe('defense and stagger engine', () => {
  it('aplica dano com Defesa ativa e redução percentual', () => {
    const r = resolveDefenseHit(defense(), stagger(), 10, 8);
    expect(r.health).toBe(7);
    expect(r.defense.current).toBe(12);
    expect(r.stagger.current).toBe(0);
  });

  it('aplica dano com Defesa quebrada direto na Vida e Stagger', () => {
    const r = resolveDefenseHit(defense({ current: 0, broken: true }), stagger(), 10, 8);
    expect(r.health).toBe(10);
    expect(r.defense.current).toBe(0);
    expect(r.stagger.current).toBe(8);
  });

  it('expõe cálculos isolados de dano, defesa e stagger', () => {
    expect(calculateHealthDamage(10, defense(), stagger())).toBe(7);
    expect(calculateDefenseDamage(8, defense())).toBe(8);
    expect(calculateStaggerDamage(8, defense({ current: 0, broken: true }))).toBe(8);
  });

  it('não quebra quando Impacto é menor que a Defesa', () => {
    const r = resolveDefenseHit(defense({ current: 9 }), stagger(), 10, 8);
    expect(r.events).not.toContain('defense-break');
    expect(r.defense.current).toBe(1);
    expect(r.defense.broken).toBe(false);
    expect(r.stagger.current).toBe(0);
  });

  it('quebra exatamente a Defesa sem overflow', () => {
    const r = resolveDefenseHit(defense({ current: 8 }), stagger(), 10, 8);
    expect(r.events).toContain('defense-break');
    expect(r.defense.broken).toBe(true);
    expect(r.defense.current).toBe(0);
    expect(r.stagger.current).toBe(0);
  });

  it('converte Impacto excedente em Stagger', () => {
    const r = resolveDefenseHit(defense({ current: 5 }), stagger(), 10, 12);
    expect(r.events).toContain('defense-break');
    expect(r.stagger.current).toBe(7);
  });

  it('aumenta Stagger enquanto Defesa está quebrada', () => {
    const r = resolveDefenseHit(defense({ current: 0, broken: true }), stagger({ current: 10 }), 0, 12);
    expect(r.health).toBe(0);
    expect(r.stagger.current).toBe(22);
  });

  it('entra em Desnorteado ao atingir Stagger máximo', () => {
    const r = resolveDefenseHit(defense({ current: 0, broken: true }), stagger({ current: 95 }), 0, 10);
    expect(r.events).toContain('stagger-enter');
    expect(r.stagger.staggered).toBe(true);
    expect(r.stagger.turnsRemaining).toBe(1);
  });

  it('multiplica dano recebido durante Stagger', () => {
    const r = resolveDefenseHit(defense({ current: 0, broken: true }), stagger({ staggered: true }), 10, 0);
    expect(r.health).toBe(14);
  });

  it('perde turno e sai de Desnorteado', () => {
    const r = processStaggeredTurn(stagger({ staggered: true, turnsRemaining: 1, current: 100 }));
    expect(r.skipped).toBe(true);
    expect(r.exited).toBe(true);
    expect(r.stagger.staggered).toBe(false);
    expect(r.stagger.current).toBe(100 * STAGGER_EXIT_RATIO);
  });

  it('regenera Defesa e limita ao máximo', () => {
    const r = regenerateDefense(defense({ current: 19, regeneration: 8 }));
    expect(r.current).toBe(20);
  });

  it('respeita limite de reativação antes de restaurar Defesa', () => {
    const low = processDefenseRound(defense({ current: 0, regeneration: 3, broken: true }), stagger());
    expect(low.restored).toBe(false);
    const enough = processDefenseRound(
      defense({ current: 0, regeneration: 4, broken: true }),
      stagger({ current: 50 }),
    );
    expect(enough.restored).toBe(true);
    expect(enough.defense.broken).toBe(false);
    expect(enough.stagger.current).toBe(10);
  });

  it('recupera Stagger e limita em zero', () => {
    expect(recoverStagger(stagger({ current: 5, recovery: 15 })).current).toBe(0);
  });

  it('trata Dano zero com Impacto positivo', () => {
    const r = resolveDefenseHit(defense(), stagger(), 0, 5);
    expect(r.health).toBe(0);
    expect(r.defense.current).toBe(15);
  });

  it('trata Impacto zero com Dano positivo', () => {
    const r = resolveDefenseHit(defense(), stagger(), 10, 0);
    expect(r.health).toBe(7);
    expect(r.defense.current).toBe(20);
  });

  it('permite desfazer e refazer por snapshots imutáveis', () => {
    const before = { defense: defaultDefense(10), stagger: defaultStagger() };
    const after = resolveDefenseHit(before.defense, before.stagger, 10, 25);
    expect(before.defense.current).toBe(20);
    expect(before.defense.broken).toBe(false);
    expect(after.defense.broken).toBe(true);
    expect(after.stagger.current).toBe(5);
  });

  it('indica Defesa inativa quando máximo é zero', () => {
    expect(isDefenseActive(defense({ max: 0, current: 0 }))).toBe(false);
  });

  it('staggered sempre amplifica o dano, mesmo se a Defesa já regenerou e voltou a ficar ativa', () => {
    // Defesa restaurada (broken=false, current cheio) mas ainda staggered.
    const staggeredButActive = defense({ broken: false, current: 20 });
    expect(calculateHealthDamage(10, staggeredButActive, stagger({ staggered: true }))).toBe(14);
  });

  it('processDefenseRound não restaura a Defesa enquanto o alvo ainda está staggered', () => {
    const r = processDefenseRound(
      defense({ broken: true, current: 20 }),
      stagger({ staggered: true }),
    );
    expect(r.defense.broken).toBe(true);
    expect(r.restored).toBe(false);
  });
});
