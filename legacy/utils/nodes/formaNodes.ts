import { registerNodeType } from '../nodeRegistry';

export function registerFormaNodes(): void {
  registerNodeType<{ color: string }>({
    type: 'cor_token', family: 'efeito', label: 'Cor do token', category: 'Forma',
    fields: [{ key: 'color', kind: 'texto', label: 'Cor (hex)' }],
    defaults: () => ({ color: '#f59e0b' }),
    summarize: p => `Cor do token: ${p.color}`,
    interpret: (p, ctx) => { ctx.trace.push({ node: 'cor_token', detail: `Cor do token definida para ${p.color}` }); },
  });

  registerNodeType<{ icon: string }>({
    type: 'icone_token', family: 'efeito', label: 'Ícone do token', category: 'Forma',
    fields: [{ key: 'icon', kind: 'texto', label: 'URL do ícone' }],
    defaults: () => ({ icon: '' }),
    summarize: p => `Ícone do token: ${p.icon || '(nenhum)'}`,
    interpret: (p, ctx) => { ctx.trace.push({ node: 'icone_token', detail: `Ícone do token: ${p.icon}` }); },
  });
}
