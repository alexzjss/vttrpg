#!/usr/bin/env python3
"""Replace the 3 separate tab blocks (cards/items/seals) with a single arsenal block."""
import sys

TARGET = 'E:/RPG-Codex/App.tsx'

with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "        {/* Aba Habilidades */}"
end_marker   = "        {/* Aba Extras (omitted as mostly unchanged) */}\n        {activeTab === 'extras' && ("

si = content.find(start_marker)
ei = content.find(end_marker)

if si == -1 or ei == -1 or ei <= si:
    print(f"ERROR: markers not found (si={si}, ei={ei})", file=sys.stderr)
    sys.exit(1)

old_section = content[si:ei]

# ── Subtab switcher JSX ───────────────────────────────────────────
SWITCHER = (
    '            <div className="flex gap-1 p-1 mb-4 rounded-2xl w-fit flex-shrink-0"'
    " style={{ background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.06)' }}>\n"
    "              {([\n"
    "                { id: 'habilidades', label: 'Habilidades', icon: <Layers className=\"w-3.5 h-3.5\" /> },\n"
    "                { id: 'itens',       label: 'Itens',       icon: <Backpack className=\"w-3.5 h-3.5\" /> },\n"
    "                { id: 'selos',       label: 'Selos',       icon: <Sparkles className=\"w-3.5 h-3.5\" /> },\n"
    "                { id: 'armas',       label: 'Armas',       icon: <Swords className=\"w-3.5 h-3.5\" /> },\n"
    "              ] as const).map(sub => (\n"
    "                <button\n"
    "                  key={sub.id}\n"
    "                  onClick={() => setArsenalSubTab(sub.id as any)}\n"
    "                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${arsenalSubTab === sub.id ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(201,152,58,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}\n"
    "                >\n"
    "                  {sub.icon} {sub.label}\n"
    "                </button>\n"
    "              ))}\n"
    "            </div>"
)

# ── Weapons panel JSX ────────────────────────────────────────────
WEAPONS_PANEL = (
    "\n"
    "            {arsenalSubTab === 'armas' && (\n"
    '              <div className="space-y-8 anim-fade-up mp-darktab" style={{ height:\'100%\', overflowY:\'auto\' }}>\n'
    '                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">\n'
    "                  <div>\n"
    '                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">Armaria</h2>\n'
    '                    <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs mt-1">Catálogo de Armas</p>\n'
    "                  </div>\n"
    '                  <div className="flex gap-3 w-full md:w-auto">\n'
    '                    <div className="relative flex-1 md:flex-none">\n'
    '                      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />\n'
    '                      <input type="text" placeholder="Buscar..." className="w-full md:w-64 bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-5 py-3 text-sm text-white focus:border-amber-600 outline-none" value={weaponSearchTerm} onChange={e => setWeaponSearchTerm(e.target.value)} />\n'
    "                    </div>\n"
    '                    <button onClick={() => setEditingWeapon({} as Weapon)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold uppercase tracking-wider whitespace-nowrap">\n'
    '                      <Plus className="w-4 h-4" /> Nova Arma\n'
    "                    </button>\n"
    "                  </div>\n"
    "                </div>\n"
    "\n"
    "                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:14 }}>\n"
    "                  {filteredWeapons.map(w => (\n"
    "                    <div key={w.id} onClick={() => setEditingWeapon(w)} style={{ cursor:'pointer', borderRadius:16, overflow:'hidden', border:'1px solid var(--border-gold)', background:'linear-gradient(165deg, rgba(40,30,5,0.85), rgba(20,16,8,0.92))', position:'relative' }} className=\"hover:brightness-110 transition-all\">\n"
    "                      <div style={{ height:120, background: w.image ? `url(${w.image}) center/cover` : 'linear-gradient(145deg,#1e180e,#100e08)', display:'flex', alignItems:'center', justifyContent:'center' }}>\n"
    "                        {!w.image && <Swords style={{ width:36, height:36, opacity:0.15 }} />}\n"
    "                      </div>\n"
    "                      <div style={{ padding:'10px 12px' }}>\n"
    "                        <p style={{ fontSize:13, fontWeight:800, color:'var(--gold-pale)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</p>\n"
    "                        <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>\n"
    "                          {w.category && <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{w.category}</span>}\n"
    "                          {(w.damage ?? 0) > 0 && <span style={{ fontSize:9, color:'#f87171' }}>{w.damage}⚔</span>}\n"
    "                          {(w.bonus ?? 0) !== 0 && <span style={{ fontSize:9, color:'#86efac' }}>{(w.bonus ?? 0) >= 0 ? '+' : ''}{w.bonus}</span>}\n"
    "                          {w.range && <span style={{ fontSize:9, color:'#94a3b8' }}>{w.range === 'melee' ? '⚔' : w.range === 'ranged' ? '\U0001f3f9' : '\U0001f3af'}</span>}\n"
    "                        </div>\n"
    "                      </div>\n"
    "                    </div>\n"
    "                  ))}\n"
    "                  {weapons.length === 0 && (\n"
    "                    <p style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', padding:'40px 0' }}>Nenhuma arma no catálogo. Clique em \"Nova Arma\".</p>\n"
    "                  )}\n"
    "                </div>\n"
    "              </div>\n"
    "            )}\n"
    "          </div>\n"
    "        )}"
)

# ── Apply replacements ───────────────────────────────────────────

# A. Cards block header → arsenal wrapper + switcher + habilidades panel open
OLD_A = "        {/* Aba Habilidades */}\n        {activeTab === 'cards' && (\n"
NEW_A = (
    "        {/* Aba Arsenal */}\n"
    "        {activeTab === 'arsenal' && (\n"
    "          <div className=\"flex flex-col mp-darktab\" style={{ height:'100%' }}>\n"
    + SWITCHER + "\n"
    "\n"
    "            {arsenalSubTab === 'habilidades' && (\n"
)
assert OLD_A in old_section, "OLD_A not found"
new_section = old_section.replace(OLD_A, NEW_A, 1)

# B. Items block header → itens panel open
OLD_B = "\n\n        {/* Aba Itens (catálogo) */}\n        {activeTab === 'items' && (\n"
NEW_B = "\n\n            {arsenalSubTab === 'itens' && (\n"
assert OLD_B in new_section, "OLD_B not found"
new_section = new_section.replace(OLD_B, NEW_B, 1)

# C. Seals block header → selos panel open  (─ = BOX DRAWINGS LIGHT HORIZONTAL)
OLD_C = "\n\n        {/* ─── ABA SELOS ─── */}\n        {activeTab === 'seals' && (\n"
NEW_C = "\n\n            {arsenalSubTab === 'selos' && (\n"
assert OLD_C in new_section, "OLD_C not found"
new_section = new_section.replace(OLD_C, NEW_C, 1)

# D. Append weapons panel + close arsenal wrapper before the trailing blank lines
TRAIL = "        )}\n\n"
assert new_section.endswith(TRAIL), f"Unexpected end: {repr(new_section[-60:])}"
new_section = new_section[:-len(TRAIL)] + "        )}" + WEAPONS_PANEL + "\n\n"

# ── Assertions ───────────────────────────────────────────────────
assert "activeTab === 'cards'" not in new_section, "Old cards condition still present"
assert "activeTab === 'items'" not in new_section, "Old items condition still present"
assert "activeTab === 'seals'" not in new_section, "Old seals condition still present"
assert "arsenalSubTab === 'habilidades'" in new_section
assert "arsenalSubTab === 'itens'" in new_section
assert "arsenalSubTab === 'selos'" in new_section
assert "arsenalSubTab === 'armas'" in new_section
assert "activeTab === 'arsenal'" in new_section
print("All assertions passed!")

# ── Write back ───────────────────────────────────────────────────
result = content[:si] + new_section + content[ei:]
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(result)

print(f"Done! Old: {len(old_section)} chars → New: {len(new_section)} chars")
