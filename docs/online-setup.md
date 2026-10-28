# Guia de configuração do modo online

Este guia explica, passo a passo, como colocar o modo online do VTT RPG para funcionar, usando o Supabase (banco de dados e autenticação) e a Vercel (hospedagem do site e do servidor).

Não é preciso saber programar para seguir este guia, mas é preciso ter acesso às contas do Supabase e da Vercel.

> **Importante:** sem as variáveis de ambiente descritas abaixo, o aplicativo continua funcionando normalmente no **modo local**, offline, no próprio navegador. Você só precisa seguir este guia se quiser usar o modo online.

Os nomes dos botões e menus podem mudar um pouco com o tempo, porque os painéis do Supabase e da Vercel são atualizados com frequência. Se algo não estiver exatamente onde descrito, procure pelo nome do item.

---

## Visão geral

Ao final da configuração você terá:

- um projeto no Supabase com as tabelas do modo online;
- um arquivo `.env.local` no seu computador, com as chaves usadas durante o desenvolvimento;
- as mesmas chaves cadastradas na Vercel, para o site publicado;
- um usuário **mestre** criado, que pode então criar campanhas, personagens e contas de jogador.

---

## Passo 1: criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e entre na sua conta (ou crie uma conta gratuita).
2. Clique em **New project**.
3. Dê um nome ao projeto (por exemplo, `vtt-rpg`).
4. Escolha a **região mais próxima de você** (para o Brasil, normalmente São Paulo).
5. Escolha o plano **gratuito (Free)**.
6. Defina uma senha para o banco de dados e guarde-a em um lugar seguro.
7. Clique em **Create new project** e aguarde alguns minutos até o projeto ficar pronto.

---

## Passo 2: criar as tabelas

1. No menu lateral do projeto, abra **SQL Editor**.
2. Clique em **New query** (ou em uma aba nova de consulta).
3. Abra no seu computador o arquivo `supabase/migrations/0001_vtt_online.sql`, que fica dentro da pasta do projeto.
4. Copie **todo** o conteúdo desse arquivo e cole na janela do SQL Editor.
5. Clique em **Run**.
6. Confira se apareceu uma mensagem de sucesso, sem erros em vermelho.

Esse script só precisa ser executado uma vez. Se você executá-lo de novo, pode aparecer erro dizendo que algo já existe; isso é esperado e não quebra o projeto.

---

## Passo 3: desligar o cadastro público

Para que só o mestre crie contas, o cadastro aberto precisa ficar desligado.

1. No menu lateral, abra **Authentication**.
2. Entre em **Sign In / Providers** (ou em **Settings**, dependendo da versão do painel).
3. Localize a opção **Allow new users to sign up** e **desligue** essa opção.
4. Salve as alterações, se o painel pedir.

---

## Passo 4: copiar as chaves do Supabase

As chaves ficam em **Project Settings** (o ícone de engrenagem no menu lateral). Você vai precisar de três valores:

- **Project URL**: o endereço do seu projeto. Ele fica na página inicial do projeto ou em **Project Settings → Data API**. Tem o formato `https://<sua-referencia>.supabase.co`.
- **Publishable key** (chave pública): fica em **Project Settings → API Keys**. Começa com `sb_publishable_`.
- **Secret key** (chave secreta): também fica em **Project Settings → API Keys**. Começa com `sb_secret_`.

> **Atenção:** a **secret key** é uma senha de administrador do seu banco. Nunca a envie para ninguém, nunca a publique em redes sociais e nunca a coloque em um arquivo que vá para o git. A publishable key pode ir para o navegador; a secret key não.

Copie os três valores para um bloco de notas temporário enquanto segue os próximos passos. Não deixe esse bloco de notas em um lugar público.

---

## Passo 5: criar o arquivo `.env.local`

O arquivo `.env.local` guarda as configurações usadas quando você roda o projeto no seu computador.

1. Na pasta raiz do projeto (a mesma pasta onde está o `README.md`), crie um arquivo chamado exatamente `.env.local`.
   - Dica: copie o arquivo `.env.example` que já existe na pasta, renomeie a cópia para `.env.local` e preencha os valores.
2. Preencha as cinco variáveis abaixo, substituindo os textos entre `<>` pelos seus valores:

```
VITE_SUPABASE_URL=<sua-url-do-projeto>
VITE_SUPABASE_PUBLISHABLE_KEY=<sua-publishable-key>
SUPABASE_URL=<sua-url-do-projeto>
SUPABASE_SECRET_KEY=<sua-secret-key>
SETUP_TOKEN=<seu-token-longo-aleatorio>
```

O que cada uma faz:

| Variável | Para que serve | Onde pode aparecer |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Endereço do Supabase usado pelo navegador | Pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública usada pelo navegador | Pública |
| `SUPABASE_URL` | Mesmo endereço, usado pelo servidor | Somente servidor |
| `SUPABASE_SECRET_KEY` | Chave de administrador do banco | **Somente servidor** |
| `SETUP_TOKEN` | Senha temporária que libera a criação do primeiro mestre | **Somente servidor** |

Observações:

- `VITE_SUPABASE_URL` e `SUPABASE_URL` têm **o mesmo valor**.
- Nunca troque o nome dessas variáveis e não adicione nada depois do `=`, a não ser o seu valor.
- Para gerar o `SETUP_TOKEN`, use um texto longo e aleatório. No PowerShell, este comando gera um bom valor:

  ```powershell
  [Convert]::ToBase64String((1..48 | % {Get-Random -Max 256}) -as [byte[]])
  ```

  Você também pode usar o gerador de senhas do seu gerenciador de senhas (por exemplo, 1Password, Bitwarden ou o do navegador), com 40 caracteres ou mais.

Esse arquivo **nunca vai para o git**: ele já está listado no `.gitignore`, então o Git o ignora. Não envie esse arquivo por e-mail, WhatsApp ou Discord.

---

## Passo 6: cadastrar as mesmas variáveis na Vercel

O site publicado na Vercel precisa das mesmas cinco variáveis.

1. Acesse [vercel.com](https://vercel.com) e abra o projeto **`vat`**.
2. Vá em **Settings → Environment Variables**.
3. Adicione cada uma das cinco variáveis do Passo 5, com o mesmo nome e o mesmo valor.
4. Em cada variável, marque os ambientes **Production** e **Preview**.
5. Salve.
6. Depois de cadastrar tudo, faça um novo deploy (em **Deployments**, use **Redeploy** no deployment mais recente), para que as variáveis passem a valer.

---

## Passo 7: criar o mestre

Esta é a etapa que cria o primeiro usuário, o **mestre**. O endereço do servidor é a URL do seu site na Vercel, por exemplo `https://vat.vercel.app`. Use no lugar de `<sua-url>` o endereço de produção, sem barra no final.

Regras para o nome de usuário e a senha:

- **Nome de usuário**: de 3 a 32 caracteres, usando apenas letras minúsculas, números, `_` ou `-`. Precisa começar com letra ou número.
- **Senha**: no mínimo 6 caracteres.

Antes de começar, confira se o servidor está no ar: abra no navegador `<sua-url>/api/health`. Deve aparecer uma resposta de confirmação.

### Opção A: curl (Mac, Linux ou Windows com curl)

```bash
curl -X POST <sua-url>/api/setup \
  -H "Content-Type: application/json" \
  -d '{"token": "<seu-token>", "username": "<seu-usuario>", "password": "<sua-senha>"}'
```

### Opção B: PowerShell (Windows)

```powershell
$body = @{
  token    = '<seu-token>'
  username = '<seu-usuario>'
  password = '<sua-senha>'
} | ConvertTo-Json

Invoke-RestMethod -Uri '<sua-url>/api/setup' -Method Post -ContentType 'application/json' -Body $body
```

Use o mesmo valor de `SETUP_TOKEN` que você cadastrou no Passo 5 e na Vercel.

### Possíveis respostas

- **Sucesso**: o servidor responde confirmando que o mestre foi criado.
- **403**: o `token` está errado. Confira se é exatamente o valor de `SETUP_TOKEN`.
- **409 `already_setup`**: já existe um mestre. Esse endpoint funciona apenas uma vez. Não é preciso repetir a etapa.
- **Erro de validação**: confira o nome de usuário e a senha, seguindo as regras acima.

> **Atenção com preview:** os deployments de *Preview* da Vercel ficam protegidos pelo login da própria Vercel. Se você chamar `/api/setup` em um endereço de preview, o navegador ou o curl recebe um redirecionamento para a tela de login da Vercel. Por isso, use **sempre a URL de Production** para essa chamada. Se quiser testar a partir de um preview, faça o teste com você logado na Vercel no navegador.

### Passo de segurança: trocar o SETUP_TOKEN

Depois de criar o mestre, troque o `SETUP_TOKEN` por um novo valor aleatório, ou remova a variável:

1. Na Vercel, em **Settings → Environment Variables**, edite `SETUP_TOKEN` (ou apague a variável).
2. Faça um novo **Redeploy**.
3. No seu `.env.local`, faça a mesma alteração.

O endpoint já fica bloqueado depois do primeiro mestre, mas trocar o token é uma camada extra de segurança.

---

## Passo 8: teste de funcionamento (smoke test)

Este teste confirma que o fluxo básico está funcionando.

1. Abra o site e entre com o usuário **mestre**.
2. Crie uma **campanha**.
3. Crie um **personagem** (PC) nessa campanha.
4. Crie uma **conta de jogador** vinculada a esse personagem.
5. Abra uma **janela anônima** (ou privada) do navegador e entre com a conta do jogador.
6. Mova um token na mesa.
7. Confira se o movimento aparece **nas duas telas**: a do mestre e a do jogador.

---

## Passo 9: teste de vazamento (manual)

Este teste confirma que o jogador não consegue ver o que é só do mestre, como NPCs ocultos.

1. Com a conta do jogador aberta na janela anônima, abra o **DevTools** (tecla `F12`) e vá para a aba **Network** (Rede), filtrando por **WS** (WebSocket).
2. Confira que **não aparecem NPCs ocultos** nas mensagens recebidas.
3. Na aba **Console**, tente se inscrever no canal da campanha no modo mestre (`campaign:<id>:gm`) usando o token do jogador. O servidor deve **recusar** a inscrição.

Se algum NPC oculto aparecer para o jogador, **não use o modo online com jogadores** até o problema ser corrigido.

---

## Passo 10: desativar a conta de um jogador

1. Entre como mestre.
2. Vá até a conta do jogador e desative-a.
3. Volte à janela anônima e tente qualquer ação com a conta do jogador.
4. A ação deve **falhar**.

---

## Problemas comuns

- **O site abre, mas o modo online não conecta**: confira se as cinco variáveis estão cadastradas na Vercel, com os nomes exatamente iguais, e se você fez um **Redeploy** depois de cadastrá-las.
- **Erro ao criar o mestre**: veja a seção de respostas do Passo 7.
- **Alterei o `.env.local` e nada mudou**: reinicie o servidor de desenvolvimento (feche o terminal e rode `npm run dev` de novo).
- **Chave colada com espaço ou quebra de linha**: remova espaços extras no começo e no fim de cada valor.
