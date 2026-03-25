# WhatsApp Web - Especificação Completa UI/UX

**Data**: 22/03/2026
**Status**: Pesquisa Completa - Pronto para Implementação
**Objetivo**: Replicar pixel-perfect o WhatsApp Web oficial

---

## ÍNDICE

1. [Barra Lateral Esquerda](#1-barra-lateral-esquerda)
2. [Header Superior](#2-header-superior)
3. [Barra de Pesquisa](#3-barra-de-pesquisa)
4. [Filtros e Listas](#4-filtros-tabs)
5. [Seção Arquivadas](#5-arquivadas)
6. [Item de Chat](#6-item-de-chat-lista)
7. [Menu Clique Direito](#7-menu-clique-direito-chat)
8. [Área de Chat (Direita)](#8-área-de-chat-lado-direito)
9. [Painel Info do Contato](#9-painel-info-do-contato)
10. [Features Ocultas](#10-features-ocultas)
11. [Atalhos de Teclado](#11-atalhos-de-teclado)

---

## 1. BARRA LATERAL ESQUERDA (Navegação Vertical)

Coluna estreita no extremo esquerdo, fundo escuro, ícones empilhados verticalmente.

| Posição | Ícone | Nome | Função | Badge | Comportamento |
|---------|-------|------|--------|-------|---------------|
| 1 (topo) | 💬 | Chats | Mostra lista de conversas | 99+ (unread count) | Ativo tem highlight/fill |
| 2 | ⭕ tracejado | Status | Abre Stories/Updates | - | Clique abre tab Status |
| 3 | 📢 | Canais | Lista de canais | - | Clique abre tab Channels |
| 4 | 👥 | Comunidades | Hub de comunidades | - | Clique abre Communities |
| 5 | 🔵✨ | Meta AI | Chat com IA | - | Círculo azul gradiente |
| Inferior | ⚙️ | Configurações | Painel settings | - | Clique > Settings panel |
| Inferior | 👤 | Perfil | Editar dados | - | Clique > Profile editor |

### Estados do Ícone Chat:
- **Normal**: Ícone cinza
- **Unread**: Ícone branco + badge verde com número (99+)
- **Active**: Ícone branco + fundo/highlight

---

## 2. HEADER SUPERIOR

Localizado acima da lista de chats.

```
┌─────────────────────────────────────────┐
│ WhatsApp              [+]          [⋮]  │
└─────────────────────────────────────────┘
```

| Elemento | Posição | Descrição | Clique |
|----------|---------|-----------|--------|
| **"WhatsApp"** | Esquerda | Brand text em negrito | Voltar para chat list |
| **[+] Novo Chat** | Direita | Ícone mais | Abre "New Chat" panel (Ctrl+Alt+N) |
| **[⋮] Menu** | Extrema direita | Três pontos | Abre dropdown menu |

### Menu 3 Pontos (Header) - Dropdown:

```
┌─────────────────────────────┐
│ Novo grupo                  │ (Ctrl+Alt+Shift+N)
│ Nova comunidade             │
│ Mensagens favoritas         │
│ Selecionar conversas        │
│ Configurações               │ (Ctrl+Alt+,)
│ Sair                        │ (Logout)
└─────────────────────────────┘
```

**Detalhes**:
- **Novo grupo**: Abre flow criar grupo → selecionar participantes → nome/ícone
- **Nova comunidade**: Abre flow comunidade (até 100 grupos, 2k membros)
- **Mensagens favoritas**: Lista global de msgs starred (privada)
- **Selecionar conversas**: Entra em modo multi-select
- **Configurações**: Abre Settings panel completo
- **Sair**: Faz logout da sessão

---

## 3. BARRA DE PESQUISA

Localizada abaixo do header, expandindo horizontalmente.

```
┌────────────────────────────────────────┐
│ 🔍 Pesquisar ou começar uma conversa  │
└────────────────────────────────────────┘
```

| Estado | Visual | Comportamento |
|--------|--------|---------------|
| **Idle** | Ícone lupa + placeholder | Nenhum |
| **Focus** | Seta voltar + input | Filtra chat list real-time |
| **Com resultados** | Lista de matches | Mostra contatos, chats, msgs, mídia, links, docs |

**Funcionalidades**:
- Busca em nomes de contatos
- Busca em nomes de grupos
- Busca em conteúdo de mensagens
- Busca em mídia, links, documentos
- Escopo: se filtro customizado ativo, busca apenas dentro daquele filtro

**Atalho**: `Ctrl+Alt+Shift+/`

---

## 4. FILTROS (Tabs)

Linha horizontal de chips/pills abaixo da barra de pesquisa. Scrollável se houver muitos filtros customizados.

```
┌─────────────────────────────────────────┐
│ [Tudo] [Não lidas 193] [Favoritos] [▼] │
│   └─ [Family] [Work] [Friends] [+]     │
└─────────────────────────────────────────┘
```

| Tab | Visual | Função |
|-----|--------|--------|
| **Tudo** | Verde claro (ativo) | Mostra todas as conversas (padrão) |
| **Não lidas [N]** | Badge com contador | Mostra apenas chats não lidos. Long-press → "Mark all as read" |
| **Favoritos** | Ícone ⭐ | Mostra apenas chats favoritos |
| **Grupos** | (opcional em v2025) | Mostra apenas grupos |
| **[▼] Dropdown** | Seta pra baixo | Gerenciar listas customizadas |
| **[+] Plus** | Verde | Criar nova lista customizada |

### Listas Customizadas:
- **Limite**: Até 20 listas customizadas
- **Conteúdo**: Podem conter chats individuais E grupos
- **Acesso**: Direita clique na lista → Renomear / Excluir
- **Privacidade**: 100% privada, ninguém mais vê suas listas
- **Sincronização**: Sincroniza entre dispositivos linkados

---

## 5. ARQUIVADAS

Seção especial no topo da lista de chats.

```
┌──────────────────────────────┐
│ 📁 Arquivadas          [@]    │
└──────────────────────────────┘
```

| Elemento | Comportamento |
|----------|---------------|
| **"Arquivadas"** | Clique abre lista de chats arquivados |
| **Ícone pasta** | Indicador visual |
| **Badge @** | Verde, aparece se menção em chat arquivado |
| **Contador** | Mostra número de chats arquivados |

### Comportamento de Archive:
- Chats permanecem arquivados mesmo com novas mensagens
- Notificações suprimidas EXCETO:
  - ✅ Menções diretas (@name)
  - ✅ Respostas/replies diretas
  - ✅ Status mentions
- Hover → dropdown abre > "Desfixar conversa"

---

## 6. ITEM DE CHAT (Lista)

Cada chat é um item na lista com estrutura:

```
┌────────────────────────────────────────────┐
│ [Avatar] Nome Chat            quinta-feira│
│          ✓✓ última mensagem...  📌 🔇 [3] │
└────────────────────────────────────────────┘
```

### Componentes:

#### 6.1 Avatar / Profile Picture
- **Posição**: Esquerda, circular
- **Conteúdo**: Foto do contato, foto do grupo, ou placeholder com cor/iniciais
- **Tamanho**: ~40-50px
- **Ação**: Nenhuma (mas clique no item abre o chat)

#### 6.2 Nome do Chat
- **Posição**: Topo da área de texto
- **Conteúdo**: Nome contato (de telefone), nome do grupo, ou número telefone
- **Estilo**: **Bold se não lido**, normal se lido
- **Truncagem**: Ellipsis se muito longo

#### 6.3 Timestamp (Data/Hora)
- **Posição**: Topo direita
- **Formatos**:
  - `HH:MM` para hoje (ex: "10:08", "07:49")
  - `"Ontem"` para ontem
  - Nome do dia (ex: "quinta-feira") para semana atual
  - `DD/MM/YYYY` para datas antigas
- **Cor**: 🟢 Verde se não lido, ⚫ Cinza se lido
- **Atalho**: Atualiza ao receber nova mensagem

#### 6.4 Preview da Última Mensagem
- **Posição**: Inferior esquerda
- **Conteúdo**: Truncado em ~50 caracteres
- **Cor**: Cinza (secundário)
- **Formatos por tipo de mídia**:

| Tipo | Ícone | Texto |
|------|-------|-------|
| Texto | - | Texto truncado |
| Foto | 📷 | "Foto" ou caption |
| Vídeo | 🎥 | "Vídeo" ou caption |
| Voice | 🎤 | "Mensagem de voz" |
| Áudio | 🎵 | "Áudio" |
| Documento | 📄 | "Documento" ou filename |
| Sticker | ✨ | "Figurinha" |
| GIF | 🎬 | "GIF" |
| Contato | 👤 | "Cartão de contato" |
| Localização | 📍 | "Localização" |
| View Once | ① | "Foto/Vídeo (view once)" |
| Link | 🔗 | URL ou título do link |
| Enquete | 📊 | "Enquete" |
| Encaminhada | ➡️ | Forward icon + content |

#### 6.5 Prefixo em Grupos
- **"Você:"** quando você enviou a última msg
- **"[Nome Contato]:"** quando outro membro enviou
- **"[5511...]:"** quando contato não salvo enviou

#### 6.6 Status Ticks (Suas mensagens)
- **Posição**: Antes da preview
- **Só aparece**: Se você enviou a última msg
- Símbolos:
  - ⏰ Pendente (clock icon)
  - ✓ Enviado (single grey tick)
  - ✓✓ Entregue (double grey ticks)
  - ✓✓ 🔵 Lido (double blue ticks)

#### 6.7 Ícones Indicadores (Inferior Direita)
- **Posição**: Canto inferior direito
- **Espaçamento**: Stacked verticalmente se múltiplos

| Ícone | Significado | Nota |
|-------|-------------|------|
| 📌 | Fixado | Máx 3 chats fixados |
| 🔇 | Silenciado | Notificações mutadas |
| 🟢[3] | Badge não lido | Contagem (3, 42, 649, 999+) |
| @ | Menção | Você foi @mentioned |
| ⏱️ | Mensagens temporárias | Disappearing msgs ativo |

### Estados do Item:

| Estado | Visual |
|--------|--------|
| **Normal** | Fundo padrão, texto cinza |
| **Não lido** | Fundo levemente destacado, nome bold, timestamp verde |
| **Fixado** | Pin icon visível, chat no topo |
| **Silenciado** | Mute icon visível |
| **Fixado + não lido** | Pin + badge verde + nome bold |
| **Selecionado/Ativo** | Fundo highlight (cinza/azul claro) |
| **Hover** | Fundo levemente highlighted + **seta dropdown aparece à direita** |
| **Digitando** | Preview substituído por "digitando..." (verde/itálico) |
| **Gravando áudio** | Preview substituído por "gravando áudio..." |

### Dropdown Hover:
Clique na seta que aparece ao hover → mesmo menu do clique direito

---

## 7. MENU CLIQUE DIREITO (Chat)

Clique direito em qualquer item de chat abre um dropdown menu contextual.

```
┌──────────────────────────────────────┐
│ Arquivar conversa                    │
│ Silenciar notificações           [›] │
│ Fixar conversa                       │
│ Marcar como não lida                 │
│ Adicionar a lista               [›] │
│ Adicionar aos favoritos              │
│ Apagar conversa                      │
│ ─────────────────────────────────── │
│ Sair do grupo              (só grupos)│
└──────────────────────────────────────┘
```

### Opções Detalhadas:

| Opção | Descrição | Atalho | Condicional |
|-------|-----------|--------|-------------|
| **Arquivar conversa** | Move para Arquivadas | Ctrl+Alt+E | - |
| **Silenciar notificações** | Sub: 8h / 1 sem / Sempre | Ctrl+Alt+Shift+M | Mostra "Reativar..." se já silenciado |
| **Fixar conversa** | Fixa no topo (máx 3) | Ctrl+Alt+Shift+P | Mostra "Desfixar..." se fixado |
| **Marcar como não lida** | Adds unread indicator | Ctrl+Alt+Shift+U | Mostra "Marcar como lida" se unread |
| **Adicionar a lista** | Sub-menu: escolher ou criar | - | - |
| **Adicionar aos favoritos** | Adds to Favorites filter | - | Mostra "Remover..." se favorito |
| **Apagar conversa** | Delete (com confirmação) | Ctrl+Alt+Backspace | - |
| **Sair do grupo** | Leave (com confirmação) | - | APENAS grupos |

### Estados Dinâmicos:

Os rótulos mudam se ações já aplicadas:
- "Silenciar" ↔ "Reativar notificações"
- "Fixar" ↔ "Desfixar"
- "Marcar como não lida" ↔ "Marcar como lida"
- "Adicionar aos favoritos" ↔ "Remover dos favoritos"

---

## 8. ÁREA DE CHAT (Lado Direito)

Ocupa ~70% da tela. Dividida em 3 seções: Header, Message Area, Input.

### 8.1 Header do Chat

```
┌─────────────────────────────────────────────┐
│ [Avatar] Rui Cidade         [☎️] [📹] [🔍] [⋮] │
│          online / visto ontem às 10:30       │
└─────────────────────────────────────────────┘
```

| Elemento | Clique | Comportamento |
|----------|--------|---------------|
| **Avatar + Nome** | Clique | Abre Contact Info Panel (direita) |
| **Status abaixo** | Nenhum | "online", "visto ontem às...", "digitando...", "gravando voz..." |
| **☎️ Ligar** | Clique | Chamada de voz. Se dropdown: "Áudio" / "Vídeo" |
| **📹 Vídeo** | Clique | Videochamada |
| **🔍 Busca** | Clique | Abre in-chat search bar (Ctrl+Alt+F) |
| **[⋮] Menu** | Clique | Abre dropdown menu do chat |

### Menu 3 Pontos (Chat Interior):

```
┌──────────────────────────────┐
│ Info do contato              │
│ Selecionar mensagens         │
│ Fechar conversa              │
│ Silenciar notificações   [›] │
│ Mensagens temporárias    [›] │
│ Trancar conversa             │
│ Limpar conversa              │
│ Apagar conversa              │
│ Denunciar                    │
│ Bloquear                     │
└──────────────────────────────┘
```

---

### 8.2 Área de Mensagens (Centro)

Scrollable container com todas as mensagens da conversa.

#### 8.2.1 Separadores de Data

Centrados, pill-shaped, sticky ao scroll:

```
         ┌──────────────────┐
         │   terça-feira    │  ou  │  HOJE  │  ou  │ ONTEM │
         └──────────────────┘
```

**Formatos**:
- `"HOJE"` para mensagens de hoje
- `"ONTEM"` para ontem
- Nome do dia (segunda-feira, terça-feira, etc.) para semana atual
- `"15/03/2026"` para datas antigas

---

#### 8.2.2 Mensagens - Estrutura Geral

```
Msg recebida:                    Msg enviada:
┌────────────────────────────┐  ┌────────────────────────────┐
│ Seu nome (grupo)           │  │                              │
│ Oi, tudo bem?        10:05 │  │              Como vai? ✓✓ 18:05 │
└────────────────────────────┘  └────────────────────────────┘
```

**Propriedades**:
- **Recebida**: Branca/light, alinhada esquerda
- **Enviada**: Verde/light-green, alinhada direita
- **Bolha**: Rounded corners, tail/arrow na msg primeira da sequência
- **Timestamp**: Canto inferior direito da bolha

---

#### 8.2.3 Tipos de Mensagem

##### Texto Simples

```
┌─────────────────────────────┐
│ Isso é um teste      18:05 ✓│
└─────────────────────────────┘
```

**Formatação suportada**:
- `*negrito*` → **negrito**
- `_itálico_` → _itálico_
- `~riscado~` → ~~riscado~~
- `` `monospace` `` → `monospace`
- Links auto-detectados → clicáveis, com preview card (título + descrição + thumbnail)
- @mentions em grupos → destacados, clicáveis
- Emojis → renderizados como gráficos WhatsApp ou nativos
- Emoji shortcodes: `:)` → sugestão emoji

**Máximo caracteres**: ~65.536 por mensagem

---

##### Imagens

```
┌──────────────────────────┐
│ [Thumbnail JPEG/PNG]     │
│ (Caption opcional) 15:30 ✓│
└──────────────────────────┘
```

**Comportamento**:
- Clique → Abre full-screen image viewer
- Rounded corners na bolha
- Caption aparece abaixo da imagem
- Download icon se não foi baixada

---

##### Stickers

Exibido SEM bolha background (transparente), ~200x200px:

```
    🎈
```

**Comportamento**:
- Clique → mostra detalhes + opção de adicionar pack aos favoritos

---

##### Vídeos

```
┌──────────────────────────┐
│ [▶ Thumbnail] 0:45       │
│ (Caption opcional) 15:30 │
└──────────────────────────┘
```

**Comportamento**:
- Clique → Full-screen video player com controles
- Play/Pause, seekbar, volume, fullscreen, duração

---

##### Áudio / Voice Messages

```
┌──────────────────────────────────┐
│ [Foto] ▶ ▓▓▓░░░░░ 0:15 / 11:51  │
│        [1x]                       │
└──────────────────────────────────┘
```

**Elementos**:
- Avatar do remetente
- Play/Pause button
- Waveform visualization (audio amplitude bars)
- Tempo decorrido / total
- Playback speed: 1x / 1.5x / 2x
- Green dot em voice msgs não ouvidas
- Seekbar para pular posição

---

##### Documentos

```
┌──────────────────────────┐
│ 📄 relatório.pdf         │
│    2.3 MB  [⬇️ Download]  │
│                   18:05 ✓│
└──────────────────────────┘
```

**Comportamento**:
- Clique → Download ou abre no navegador
- Mostra: ícone tipo arquivo, nome, tamanho

---

##### Encaminhadas

Label acima da msg:

```
┌──────────────────────────┐
│ ➡️ Encaminhada           │
│ Texto original... 15:30 ✓│
└──────────────────────────┘
```

Se encaminhada múltiplas vezes: `"Encaminhada muitas vezes"` com dupla seta

---

##### Respondidas (Quoted)

Quando você responde uma msg, a original aparece em formato compacto:

```
┌────────────────────────────┐
│ ┌─────────────────────────┐│
│ │ ~ Giovanni              ││ ← preview da msg original
│ │ O evento é às 8pm       ││
│ └─────────────────────────┘│
│ Blz, entendi!       15:35 ✓│
└────────────────────────────┘
```

**Ao clicar na preview**:
- Pula para a mensagem original
- Brief highlight animation (flash amarelo)

---

##### View Once

Foto/vídeo/áudio visualizável apenas UMA VEZ:

```
┌──────────────────────────┐
│ [① Imagem]               │
│ (View Once)        15:30 │
└──────────────────────────┘
```

**Comportamento**:
- Clique → abre viewer
- Após fechado, não pode rever
- Não pode fazer forward, save, ou star
- Sem screenshot (protegido no mobile)

---

##### Enquetes

```
┌──────────────────────────┐
│ 📊 Qual seu time?        │
│ ☐ Flamengo (3 votos)    │
│ ☐ Corinthians (2 votos) │
│ ☐ Palmeiras (1 voto)    │
│ ☑ São Paulo (5 votos) ← você │
└──────────────────────────┘
```

**Funcionalidades**:
- Múltipla escolha toggle no topo
- Resultados em real-time
- Até 12 opções

---

##### Contatos

```
┌──────────────────────────┐
│ 👤 João Silva            │
│ 📞 +55 11 98765-4321     │
│ [➡️ Enviar mensagem]     │
└──────────────────────────┘
```

---

##### Localização

```
┌──────────────────────────┐
│ [Mapa preview]           │
│ Rua das Flores, 123      │
│ São Paulo, SP            │
│ [Abrir em Google Maps]   │
└──────────────────────────┘
```

---

#### 8.2.4 Reações de Emoji

Aparecem como bolhas abaixo da mensagem:

```
┌──────────────────────────────┐
│ Seus dados estão salvos       │
│                       18:05 ✓│
│ 👍 2    ❤️ 3    😂 1          │
└──────────────────────────────┘
```

**Comportamento**:
- Clique em um emoji → expande lista de quem reagiu
- 1 reação por pessoa por mensagem
- Clique no seu próprio emoji → remove reação
- Em canais: apenas contagem agregada (privacidade)

---

#### 8.2.5 Hover Actions (Mouse Over)

Ao passar mouse sobre qualquer msg:

```
                    ┌─😊─┐  ┌─▼─┐
┌──────────────────────────────────────┐
│ Esse foi meu texto favorito     18:05│
└──────────────────────────────────────┘
```

**Ícones que aparecem**:
- **😊 Emoji Reaction**: Clique abre quick bar com 6 defaults (👍❤️😂😮😢🙏) + "+" para picker completo
- **▼ Down Arrow**: Abre dropdown contextual menu

---

#### 8.2.6 Dropdown Menu de Mensagem

Clique no ▼ ou clique direito:

```
┌────────────────────────────┐
│ Info da mensagem           │
│ Responder                  │
│ Reagir à mensagem          │
│ Encaminhar                 │
│ Fixar (máx 3 por chat)     │
│ Destacar (favoritar)       │
│ Editar (tua, 15min)        │
│ Apagar                 [›] │
│ Copiar (apenas texto)      │
└────────────────────────────┘
```

**Para imagens, adicional**:
- Pesquisar imagem online (reverse image search)
- Download

**Para msgs suas**:
- Apagar → "Para mim" / "Para todos"
- Edit (até 15 min após envio)

---

#### 8.2.7 Indicador de Digitação

Quando contato está digitando:

```
Rui Cidade está digitando...
✏️ ✎ ✏️
```

Visual: nome + "está digitando..." com 3 pontos animados

---

#### 8.2.8 Indicador de Gravação de Voz

```
Rui Cidade está gravando áudio...
🎤
```

---

#### 8.2.9 Scroll Behavior

| Ação | Resultado |
|------|-----------|
| **Scroll up** | Lazy load de msgs antigas em chunks |
| **Scroll down** | Loading spinner no topo enquanto carrega |
| **Botão ↓ no canto** | Aparece quando scrollado pra cima. Clique pula pra msg mais recente |
| **Badge no botão ↓** | Mostra contagem de msgs não lidas abaixo do ponto de scroll |
| **Divider "X MENSAGENS NÃO LIDAS"** | Horizontal line separando msgs vistas das novas |
| **Clique em msg respondida** | Pula para msg original + flash highlight |

---

### 8.3 Área de Input (Inferior)

```
┌──────────────────────────────────────────────────┐
│ [+] 😊 [Campo de texto...........................] 🎤 │
└──────────────────────────────────────────────────┘
```

---

#### 8.3.1 Botão "+" (Anexar)

Clique abre popup com opções:

```
┌──────────────────────────┐
│ 📄 Documento             │
│ 📷 Fotos e vídeos        │
│ 📷 Câmera               │
│ 👤 Contato               │
│ 📍 Localização           │
│ 📊 Enquete               │
│ ✨ Nova figurinha        │
└──────────────────────────┘
```

| Opção | Ação |
|-------|------|
| **Documento** | File picker → PDF, DOCX, XLSX, ZIP, etc. (até 2GB) |
| **Fotos e vídeos** | Media picker do computador |
| **Câmera** | Abre webcam para captura |
| **Contato** | Selecionar contato → compartilha vCard |
| **Localização** | Interface de mapa → compartilha local atual ou buscado |
| **Enquete** | Create poll: pergunta + até 12 opções + toggle multiple choice |
| **Nova figurinha** | Cria sticker customizado de imagem |

---

#### 8.3.2 Emoji / Sticker / GIF Picker

Clique no 😊 abre painel com 3 abas:

```
┌───────────────────────────────────────┐
│ [😊 Emoji] [🎬 GIF] [✨ Sticker]      │
├───────────────────────────────────────┤
│ 🔍 Search...                          │
│                                       │
│ 😀😁😂😃😄😅😆😇😈😉 ← grid de emojis│
│                                       │
└───────────────────────────────────────┘
```

**Aba Emoji**:
- Categorias: Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols, Flags
- Seção "Recently used" no topo
- Search bar com autocomplete
- Skin tone selection (long-press)

**Aba GIF**:
- Trending GIFs de GIPHY/Tenor
- Search bar
- Click para enviar direto

**Aba Sticker**:
- Seus packs em grid
- Seção Favorites no topo
- Search bar
- "+" button para pegar novos packs
- Recentes no topo

---

#### 8.3.3 Campo de Texto

```
┌──────────────────────────────────────┐
│ Digite uma mensagem                  │
└──────────────────────────────────────┘
```

**Propriedades**:
- Placeholder: "Digite uma mensagem"
- Suporta multi-line:
  - **Enter** → envia msg
  - **Shift+Enter** → nova linha
- Auto-grow: expande conforme digita
- Limite: ~65.536 caracteres
- Suporta:
  - Cola direta de imagens → abre editor
  - Drag & drop de arquivos
  - @mentions em grupos (autocomplete)
  - Emoji shortcodes (`:)` → sugestões)
  - Text formatting: `*bold*`, `_italic_`, etc.

---

#### 8.3.4 Botão Enviar

```
Campo vazio:    Campo com texto:
   [🎤]              [✈️]
```

- **Campo vazio**: Ícone microfone 🎤
- **Campo com texto**: Ícone enviar ✈️ (círculo verde com seta)
- **Clique ou Enter**: Envia a mensagem

---

#### 8.3.5 Gravação de Áudio

**Modo click-and-hold** (original):
```
[Holding...]
Deslize ◀ para cancelar
```

- Clique + segure em 🎤
- Solte para enviar
- Deslize esquerda para cancelar

**Modo locked** (v2025+):
```
┌────────────────────────────────┐
│ 🔴 Gravando 0:15              │
│ ▓▓▓░░░░░░░░░░░░░░░ (waveform) │
│ [⏸️] [🗑️] [✈️]               │
└────────────────────────────────┘
```

- Clique único em 🎤 → modo locked
- Timer mostra duração
- Red waveform visualization
- **⏸️ Pausar/Resume**: Pausa e permite ouvir preview
- **🗑️ Lixeira**: Descarta gravação
- **✈️ Enviar**: Envia voice message

---

#### 8.3.6 Reply Preview Bar

Ao clicar "Responder" numa msg, barra aparece ACIMA do input:

```
┌──────────────────────────────────┐
│ ┌─ Giovanni                      │
│ │ Qual sua opinião sobre...      │
│ └─ [X]                           │
├──────────────────────────────────┤
│ [+] 😊 [Digite uma mensagem...] 🎤│
└──────────────────────────────────┘
```

- Borda colorida à esquerda (cor por remetente em grupos)
- Nome + preview da msg original
- Clique [X] → cancela reply

---

#### 8.3.7 Link Preview

Ao colar/digitar URL:

```
┌────────────────────────────────┐
│ [Thumbnail]                    │
│ Título da Página               │
│ Descrição resumida...          │
│ whatsapp.com/blog              │ [X]
└────────────────────────────────┘
```

- Auto-generated from OpenGraph
- [X] remove preview antes de enviar

---

#### 8.3.8 Multi-Select Mode

Ativado via "Selecionar mensagens" do menu 3 pontos:

```
☐ Msg 1
☐ Msg 2
☑ Msg 3 ← checked
☐ Msg 4

[Bottom action bar]
└─ [➡️ Forward] [🗑️ Delete] [⭐ Star]
   3 selected
```

- Checkboxes em cada msg
- Bottom bar com ações bulk
- Counter: "X selected"

---

## 9. IN-CHAT SEARCH

Clique na lupa (🔍) no header:

```
┌────────────────────────────────┐
│ ◀ [🔍 Buscar neste chat...] 📅 │
└────────────────────────────────┘
   ▲ Match 3 de 12 ▼
   Resultado highlighted em amarelo
```

- Seta voltar ◀ fecha search
- Search input
- Calendar 📅 navega para data específica
- Up/Down ▲ ▼ navega entre matches
- Matches highlighted em **yellow** no chat

**Atalho**: `Ctrl+Alt+F`

---

## 10. PAINEL INFO DO CONTATO

Abre ao clicar no avatar/nome no header. Painel à direita, pode overlay ou replace o chat:

```
┌─────────────────────────────────┐
│ [X]                             │
│ Info do contato                 │
│─────────────────────────────────│
│ [Foto grande]                   │
│ Rui Cidade                       │
│ +55 11 98765-4321               │
│ "Meu status/sobre"              │
│                                 │
│─────────────────────────────────│
│ Mídia, links e docs         [›] │
│ Mensagens destacadas        [›] │
│─────────────────────────────────│
│ 🔇 Silenciar notificações  [toggle] │
│ Mensagens temporárias       [›] │
│ 🔐 Criptografia             [›] │
│ 🔒 Trancar conversa         [toggle] │
│ Grupos em comum (3)         [›] │
│─────────────────────────────────│
│ [Bloquear] (vermelho)           │
│ [Denunciar] (vermelho)          │
│ [Apagar conversa] (vermelho)    │
└─────────────────────────────────┘
```

### 10.1 Seções

#### Foto
- Grande, clicável para fullscreen

#### Info Básica
- Nome em **bold**
- Telefone com código país
- Status/About text (customizado pelo contato)

#### Mídia, Links e Docs
Clique abre sub-painel com 3 abas:
- **Media**: Grid de thumbnails (fotos, vídeos com datas)
- **Links**: Lista de URLs compartilhadas
- **Docs**: Lista de documentos (nome, tamanho, data)

Cada item: forward, star, delete

#### Mensagens Destacadas
Lista de msgs que você fez star neste chat. Clique pula para msg.

#### Silenciar Notificações
Toggle + duração (8h / 1 sem / Sempre)

#### Mensagens Temporárias
Current setting: 24h / 7 dias / 90 dias / Off. Clique para mudar.

#### Criptografia
"Mensagens e chamadas são criptografadas ponta a ponta"
Código de segurança: 60 dígitos ou QR code (verificação manual)

#### Trancar Conversa
Toggle. Requer 2-step verification ativado.

#### Grupos em Comum
Lista de grupos que vocês compartilham. Clique em um → abre grupo.

#### Botões de Ação (Vermelho)
- **Bloquear [Nome]**
- **Denunciar [Nome]**
- **Apagar conversa**

---

### 10.2 Para Grupos (Diferenças)

Painel adicional mostra:
- Descrição do grupo (se houver)
- Lista de membros com labels "Admin"
- Botão "Adicionar participante"
- Invite link do grupo
- Group settings (quem pode editar info, enviar msgs)
- **Sair do grupo** (vermelho)

---

## 11. FEATURES OCULTAS

Funcionalidades não imediatamente visíveis mas parte da experiência:

### 11.1 Mensagens Temporárias (Disappearing Messages)

- **Timer Options**: Off, 24h, 7 dias, 90 dias
- **Indicador**: Ícone ⏱️ no header + ao lado das msgs
- **Per-chat setting**: Clique nome/avatar → Mensagens temporárias
- **Default**: Settings > Privacy > Mensagens temporárias (default)
- **Admin control em grupos**: Pode restringir quem altera

**Comportamento**:
- Msgs desaparecem após timer
- Não sincronizam backup
- Screenshots podem ser detectados no mobile

---

### 11.2 Editar Mensagem

- **Time window**: Até 15 minutos após envio
- **Como**: Clique ▼ on your msg > "Editar"
- **Indicador**: "Editada" label aparece após edit
- **Escopo**: Apenas text messages (talvez captions em v2025+)

---

### 11.3 View Once Media

- **Enviar**: Botão "1️⃣" ao anexar foto/vídeo/áudio
- **Comportamento**: Visualizável apenas UMA VEZ
- **Restrições**: Sem forward, save, star, screenshot (mobile)
- **Após abrir**: Desaparece, não pode rever

---

### 11.4 Chat Lock

- **Acesso**: Settings > Security > Chat Lock (mobile) ou Settings > Privacy > Chat Lock (web)
- **Requer**: 2-step verification ativado
- **Comportamento**:
  - Chat move para folder "Chats Trancados" oculto
  - Requer device authentication (fingerprint, Face ID, passcode, ou custom PIN)
  - Notificações suprimem remetente e preview
  - Excluído de search
- **Secret Code**: Código separado do phone unlock, pode ocultar mesmo a pasta trancada

---

### 11.5 Enquetes (Polls)

- **Criar**: [+] > Enquete
- **Pergunta** + até **12 opções**
- **Toggle**: Múltipla escolha on/off
- **Real-time**: Votos aparecem ao vivo
- **Em canais**: Apenas contagem agregada (privacidade)
- **Notificações**: Poll creator recebe notif de votos
- **Não pode**: Forward, apenas reply e react

---

### 11.6 Transcrição de Áudio

Settings > Chats > Transcripts de mensagens de voz

- Voice messages → auto transcrever para texto
- Linguagem configurável
- Pode ligar/desligar

---

### 11.7 Resumo AI

Em grupos com MUITAS msgs não lidas:
- Opção de gerar resumo automático de updates-chave
- Powered by Meta AI
- Optional, pode desabilitar

---

### 11.8 HD Media

- Ao anexar foto/vídeo: opção de enviar em **HD** (preserva resolução original)
- Alguns dados móveis: maior tamanho file

---

### 11.9 Passkey Login

- Biometric authentication (fingerprint/face)
- Alternativa ao QR code
- Mais seguro e rápido

---

### 11.10 Dual Account no Web

- Abra normal + aba anônima/private
- Faça login em conta diferente em cada aba
- Ambas em web.whatsapp.com

---

### 11.11 Dark Mode & Wallpaper

- **Theme**: Settings > Chat Theme > Light / Dark / System
- **Wallpaper**: Settings > Chat Wallpaper
- **Per-theme**: Pode ter wallpapers diferentes para light e dark
- **Scheduler**: Algumas versões permitem agendamento automático

---

### 11.12 Privacidade Avançada

Settings > Privacy > Advanced Chat Privacy (per-chat):
- Bloqueia export de chat
- Desabilita auto-download de mídia
- Restringe uso de IA no chat

---

### 11.13 Pinned Messages

- **Fixar msg**: Clique ▼ > "Fixar"
- **Max**: 3 mensagens por chat
- **Visualizar**: Clique no ícone pin no header
- **Em grupos**: Apenas admins podem fixar
- **Notificações**: Todos no grupo recebem notif

---

### 11.14 Pinned Chats

- **Fixar chat**: Clique direito > "Fixar conversa"
- **Max**: 3 chats fixados
- **Visualização**: No topo da lista de chats
- **Atalho**: Ctrl+Alt+Shift+P

---

### 11.15 Security Notifications

Settings > Security > "Show security notifications"

- Alerta quando código de segurança de contato muda
- Indica possível device change ou account compromise

---

### 11.16 Strict Account Settings (Bundle)

Ativa múltiplas proteções simultâneas:
- Bloqueia msgs de desconhecidos
- Silencia chamadas de desconhecidos
- Força visibilidade apenas contatos
- Ativa 2-step verification automático
- Nota: Apenas mobile, aplicações sync pra web

---

## 12. ATALHOS DE TECLADO

### Navegação & Geral

| Windows | Mac | Ação |
|---------|-----|------|
| Ctrl+Alt+N | Cmd+Opt+N | Nova conversa |
| Ctrl+Alt+Shift+N | Cmd+Opt+Shift+N | Novo grupo |
| Ctrl+Alt+Shift+/ | Cmd+Opt+Shift+/ | Buscar chats/msgs |
| Ctrl+Alt+F | Cmd+Opt+F | Buscar no chat atual |
| Ctrl+Alt+, | Cmd+Opt+, | Abrir Configurações |
| Ctrl+Alt+E | Cmd+Opt+E | Arquivar chat |
| Ctrl+Alt+Shift+M | Cmd+Opt+Shift+M | Silenciar chat |
| Ctrl+Alt+Shift+U | Cmd+Opt+Shift+U | Marcar como não lida |
| Ctrl+Alt+Shift+P | Cmd+Opt+Shift+P | Fixar chat |
| Ctrl+Alt+Backspace | Cmd+Opt+Backspace | Apagar chat |
| Ctrl+Alt+Shift+[ | Cmd+Opt+Shift+[ | Chat anterior |
| Ctrl+Alt+Shift+] | Cmd+Opt+Shift+] | Próximo chat |
| Ctrl+Alt+P | Cmd+Opt+P | Abrir Perfil |
| Ctrl+Alt+Shift+H | Cmd+Opt+Shift+H | Contatar suporte |

### Dentro da Mensagem

| Atalho | Ação |
|--------|------|
| Enter | Enviar mensagem |
| Shift+Enter | Nova linha |
| Escape | Fechar painel/busca/reply |
| Shift+Tab | Acessar emoji/sticker/GIF picker |

### Formatting (Markup)

| Syntax | Resultado |
|--------|-----------|
| `*text*` | **Bold** |
| `_text_` | _Italic_ |
| `~text~` | ~~Strikethrough~~ |
| `` ```text``` `` | Monospace |
| `:keyword` | Emoji suggestion |

---

## NOTAS DE IMPLEMENTAÇÃO

### Priorização de Features

**Phase 1 (MVP)**:
- Barra lateral com chats
- Header + chat area
- Input básico (texto)
- Menu clique direito

**Phase 2**:
- Search
- Filtros (Tudo, Não lidas, Favoritos)
- Contact Info Panel

**Phase 3**:
- Diferentes tipos de msg (imagem, vídeo, áudio, documento)
- Reactions, Replies
- Media viewers

**Phase 4**:
- Disappearing messages
- Chat Lock
- Pinned messages
- Polls

**Phase 5**:
- Communities
- Channels
- Status

---

## REFERÊNCIAS

- WhatsApp Help Center - Keyboard Shortcuts
- WABetaInfo - All Features
- WhatsApp Blog - Official announcements
- Security Overloaded, TechCabal - Feature compilations

---

**Próximas Etapas**:
1. Iniciar implementação Phase 1 (MVP)
2. Usar como spec de design
3. Criar componentes React baseado nesta spec
4. Integrar com Baileys 6.x para dados reais (via WhatsApp Web emulation)

