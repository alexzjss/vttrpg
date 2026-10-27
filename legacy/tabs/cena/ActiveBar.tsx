import React from 'react';
import type { Character } from '../../types';
import { isDefenseActive, migrateCharacterDefense } from '../../utils/defense';

export interface ActiveBarProps { active: Character | null; combat?: boolean }

const ammoStackSize = (current: number) => current > 30 ? 10 : current > 12 ? 5 : 1;

function AmmoPile({ current, max }: { current: number; max: number }) {
  const size = ammoStackSize(current);
  const fullStacks = Math.floor(current / size);
  const remainder = current % size;
  const visibleFullStacks = Math.min(fullStacks, 16);
  const stacks = [
    ...Array.from({ length: visibleFullStacks }, () => size),
    ...(remainder ? [remainder] : []),
  ];
  const hiddenAmmo = Math.max(0, fullStacks - visibleFullStacks) * size;
  return <span className="cena-active-ammo-pile" aria-label={`Municao: ${current} de ${max}`}>
    <span aria-hidden>
      {stacks.map((amount, index) => <i key={index} data-stack={amount > 1 ? amount : undefined} />)}
      {hiddenAmmo > 0 && <em>+{hiddenAmmo}</em>}
    </span>
  </span>;
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
  return <div className="cena-active-vital cena-active-vital--hp">
    <div><span>VITALIDADE</span><strong>{current}/{max}</strong></div>
    <i>
      <b style={{ width: `${pct}%` }} />
    </i>
  </div>;
}

function AuraBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
  return <div className="cena-active-vital cena-active-vital--aura">
    <div><span>AURA</span><strong>{current}/{max}</strong></div>
    <i className="cena-aura-track"><b style={{ width: `${pct}%` }} /></i>
  </div>;
}

function AmmoBar({ current, max }: { current: number; max: number }) {
  return <div className="cena-active-vital cena-active-vital--ammo">
    <div><span>MUNIÇÃO</span><strong>{current}/{max}</strong></div>
    <AmmoPile current={current} max={max} />
  </div>;
}

function DefenseBar({ character }: { character: Character }) {
  const stats = migrateCharacterDefense(character);
  const pct = stats.defenseMax > 0 ? Math.max(0, Math.min(100, stats.defenseCurrent / stats.defenseMax * 100)) : 0;
  const active = isDefenseActive(stats);
  const reduction = Math.round(stats.defenseReduction * 100);
  return <div className={`cena-active-vital cena-active-vital--defense ${stats.isDefenseBroken ? 'is-break' : active ? 'is-active' : 'is-recovering'}`}>
    <div><span>{stats.isDefenseBroken ? 'BREAK' : 'DEFESA'}</span><strong>DEF {stats.defenseCurrent}/{stats.defenseMax}</strong></div>
    <i className="cena-defense-track"><b style={{ width: `${pct}%` }} /></i>
    <small>Redução: {reduction}%</small>
  </div>;
}

function StaggerBar({ character }: { character: Character }) {
  const stats = migrateCharacterDefense(character);
  if (!stats.isDefenseBroken && !stats.isStaggered) return null;
  const pct = stats.staggerMax > 0 ? Math.max(0, Math.min(100, stats.staggerCurrent / stats.staggerMax * 100)) : 0;
  return <div className={`cena-active-vital cena-active-vital--stagger ${pct >= 80 ? 'is-danger' : ''} ${stats.isStaggered ? 'is-staggered' : ''}`}>
    <div><span>{stats.isStaggered ? 'DESNORTEADO' : 'STAGGER'}</span><strong>{stats.staggerCurrent}/{stats.staggerMax}</strong></div>
    <i className="cena-stagger-track"><b style={{ width: `${pct}%` }} /></i>
  </div>;
}

const ActiveBar: React.FC<ActiveBarProps> = ({ active, combat = false }) => {
  if (!active) return null;
  const hasAmmo = active.maxAmmo > 0;
  return (
    <div className={`cena-active-bar ${combat ? 'is-combat' : ''} ${hasAmmo ? 'has-ammo' : ''}`}>
      <HpBar current={active.currentHp} max={active.maxHp} />
      <div className="cena-active-hero">
        <div className="cena-active-hero__portrait" style={active.icon ? { backgroundImage: `url(${active.icon})` } : undefined}>{!active.icon && active.name.charAt(0)}</div>
        <strong>{active.name}</strong>
        {combat && <span>SEU TURNO</span>}
      </div>
      <AuraBar current={active.currentAura} max={active.maxAura} />
      <DefenseBar character={active} />
      <StaggerBar character={active} />
      {hasAmmo && <AmmoBar current={active.currentAmmo} max={active.maxAmmo} />}
    </div>
  );
};

export default ActiveBar;
