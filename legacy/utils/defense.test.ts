import { describe, expect, it } from 'vitest';
import {
  calculateDefenseDamage,
  calculateHealthDamage,
  calculateStaggerDamage,
  enterStaggeredState,
  exitStaggeredState,
  isDefenseActive,
  migrateCharacterDefense,
  processDefenseRound,
  processStaggeredTurn,
  recoverStagger,
  regenerateDefense,
  resolveDefenseHit,
  STAGGER_EXIT_RATIO,
  type DefenseStats,
} from './defense';

const base = (over: Partial<DefenseStats> = {}): DefenseStats => ({
  defense: 10,
  defenseMax: 20,
  defenseCurrent: 20,
  defenseReduction: 0.3,
  defenseRegeneration: 4,
  defenseActivationThreshold: 0.2,
  staggerMax: 100,
  staggerCurrent: 0,
  staggerRecovery: 15,
  staggerDamageMultiplier: 1.4,
  staggerDuration: 1,
  isDefenseBroken: false,
  isStaggered: false,
  staggerTurnsRemaining: 0,
  ...over,
});

describe('defense and stagger engine', () => {
  it('aplica dano com Defesa ativa e redução percentual', () => {
    const r = resolveDefenseHit(base(), 10, 8);
    expect(r.healthDamage).toBe(7);
    expect(r.defenseDamage).toBe(8);
    expect(r.currentDefense).toBe(12);
  });

  it('aplica dano com Defesa quebrada direto na Vida e Stagger', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 0, isDefenseBroken: true }), 10, 8);
    expect(r.healthDamage).toBe(10);
    expect(r.defenseDamage).toBe(0);
    expect(r.staggerDamage).toBe(8);
  });

  it('expõe cálculos isolados de dano, defesa e stagger', () => {
    expect(calculateHealthDamage(10, base())).toBe(7);
    expect(calculateDefenseDamage(8, base())).toBe(8);
    expect(calculateStaggerDamage(8, base({ isDefenseBroken: true }))).toBe(8);
  });

  it('não quebra quando Impacto é menor que a Defesa', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 9 }), 10, 8);
    expect(r.defenseBroken).toBe(false);
    expect(r.currentDefense).toBe(1);
    expect(r.currentStagger).toBe(0);
  });

  it('quebra exatamente a Defesa sem overflow', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 8 }), 10, 8);
    expect(r.defenseBroken).toBe(true);
    expect(r.currentDefense).toBe(0);
    expect(r.staggerDamage).toBe(0);
  });

  it('converte Impacto excedente em Stagger', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 5 }), 10, 12);
    expect(r.defenseBroken).toBe(true);
    expect(r.staggerDamage).toBe(7);
    expect(r.currentStagger).toBe(7);
  });

  it('aumenta Stagger enquanto Defesa está quebrada', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 0, isDefenseBroken: true, staggerCurrent: 10 }), 0, 12);
    expect(r.healthDamage).toBe(0);
    expect(r.currentStagger).toBe(22);
  });

  it('entra em Desnorteado ao atingir Stagger máximo', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 0, isDefenseBroken: true, staggerCurrent: 95 }), 0, 10);
    expect(r.enteredStaggered).toBe(true);
    expect(r.target.isStaggered).toBe(true);
    expect(r.target.staggerTurnsRemaining).toBe(1);
  });

  it('multiplica dano recebido durante Stagger', () => {
    const r = resolveDefenseHit(base({ defenseCurrent: 0, isDefenseBroken: true, isStaggered: true }), 10, 0);
    expect(r.healthDamage).toBe(14);
  });

  it('perde turno e sai de Desnorteado', () => {
    const r = processStaggeredTurn(base({ isStaggered: true, staggerTurnsRemaining: 1, staggerCurrent: 100 }));
    expect(r.skippedTurn).toBe(true);
    expect(r.exitedStaggered).toBe(true);
    expect(r.target.isStaggered).toBe(false);
    expect(r.currentStagger).toBe(100 * STAGGER_EXIT_RATIO);
  });

  it('regenera Defesa e limita ao máximo', () => {
    const r = regenerateDefense(base({ defenseCurrent: 19, defenseRegeneration: 8 }));
    expect(r.defenseCurrent).toBe(20);
  });

  it('respeita limite de reativação antes de restaurar Defesa', () => {
    const low = processDefenseRound(base({ defenseCurrent: 0, defenseRegeneration: 3, isDefenseBroken: true }));
    expect(low.defenseRestored).toBe(false);
    const enough = processDefenseRound(base({ defenseCurrent: 0, defenseRegeneration: 4, isDefenseBroken: true, staggerCurrent: 50 }));
    expect(enough.defenseRestored).toBe(true);
    expect(enough.target.isDefenseBroken).toBe(false);
    expect(enough.currentStagger).toBe(10);
  });

  it('recupera Stagger e limita em zero', () => {
    expect(recoverStagger(base({ staggerCurrent: 5, staggerRecovery: 15 })).staggerCurrent).toBe(0);
  });

  it('trata Dano zero com Impacto positivo', () => {
    const r = resolveDefenseHit(base(), 0, 5);
    expect(r.healthDamage).toBe(0);
    expect(r.defenseDamage).toBe(5);
  });

  it('trata Impacto zero com Dano positivo', () => {
    const r = resolveDefenseHit(base(), 10, 0);
    expect(r.healthDamage).toBe(7);
    expect(r.defenseDamage).toBe(0);
  });

  it('migra personagens antigos de forma idempotente', () => {
    const old = { id: 'p1', name: 'Mikhail', defense: 12 };
    const migrated = migrateCharacterDefense(old);
    expect(migrated.defenseMax).toBe(24);
    expect(migrateCharacterDefense(migrated).defenseCurrent).toBe(24);
  });

  it('preserva persistência de Break e Stagger em snapshot', () => {
    const saved = JSON.parse(JSON.stringify(migrateCharacterDefense({ id: 'p1', defense: 10, isDefenseBroken: true, defenseCurrent: 0, staggerCurrent: 35 })));
    const loaded = migrateCharacterDefense(saved);
    expect(loaded.isDefenseBroken).toBe(true);
    expect(loaded.staggerCurrent).toBe(35);
  });

  it('permite desfazer e refazer por snapshots imutáveis', () => {
    const before = migrateCharacterDefense({ id: 'p1', defense: 10 });
    const after = resolveDefenseHit(before, 10, 25).target;
    const history = [before, after];
    expect(history[0].defenseCurrent).toBe(20);
    expect(history[1].isDefenseBroken).toBe(true);
    expect(history[0].isDefenseBroken).toBe(false);
  });

  it('normaliza valores inválidos sem NaN', () => {
    const migrated = migrateCharacterDefense({ defense: Number.NaN, defenseMax: -1, staggerCurrent: Number.NaN });
    expect(Number.isNaN(migrated.defenseMax)).toBe(false);
    expect(migrated.defenseMax).toBe(0);
    expect(migrated.staggerCurrent).toBe(0);
  });

  it('indica Defesa inativa quando máximo é zero', () => {
    expect(isDefenseActive(base({ defenseMax: 0, defenseCurrent: 0 }))).toBe(false);
  });

  it('staggered sempre amplifica o dano, mesmo se a Defesa já regenerou e voltou a ficar ativa', () => {
    // Defesa restaurada (isDefenseBroken=false, defenseCurrent cheio) mas ainda staggered —
    // estado que acontecia quando processDefenseRound restaurava a Defesa sem checar isStaggered.
    const staggeredButActive = base({ isDefenseBroken: false, isStaggered: true, defenseCurrent: 20 });
    expect(calculateHealthDamage(10, staggeredButActive)).toBe(14);
  });

  it('processDefenseRound não restaura a Defesa enquanto o alvo ainda está staggered', () => {
    const broken = base({ isDefenseBroken: true, isStaggered: true, defenseCurrent: 20 });
    const r = processDefenseRound(broken);
    expect(r.target.isDefenseBroken).toBe(true);
    expect(r.defenseRestored).toBe(false);
  });
});
