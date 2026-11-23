# StudyOps

Painel pessoal para planejar uma formação em TI e estudar entre chamados. A aplicação roda em português no navegador e grava currículo, sessões, anotações e preferências em IndexedDB. O primeiro acesso cria oito fases editáveis, com 32 tópicos, 32 atividades práticas e 17 materiais iniciais. O histórico começa vazio.

## Executar localmente

Use Node.js 22.12 ou superior e pnpm. Na pasta do projeto, execute:

```sh
pnpm install
pnpm dev
```

Abra o endereço informado pelo Vite. O padrão em desenvolvimento é `http://127.0.0.1:5173/`.

Para gerar e executar a versão de produção:

```sh
pnpm build
pnpm preview
```

O endereço padrão da prévia é `http://127.0.0.1:4173/`. A pasta `dist/` pode ser servida em hospedagem estática com HTTPS. Em produção ou na prévia local, abra a aplicação uma vez para carregar o cache e use o comando de instalação do navegador, quando disponível. Depois do primeiro carregamento, a trilha, o caderno, a configuração e o histórico funcionam offline. A disponibilidade dos materiais externos depende dos respectivos provedores.

O navegador separa dados por perfil, endereço e porta. Use o mesmo endereço e perfil nas próximas sessões ou transfira os dados com um backup JSON ao mudar de ambiente.

## Publicar no GitHub Pages

No repositório do GitHub, selecione **Settings → Pages → Source → GitHub Actions**. Depois, em **Actions**, execute **Publicar StudyOps no GitHub Pages**. Os próximos pushes em `main` executam o mesmo fluxo. A publicação usa apenas os arquivos estáticos gerados em `dist/`. O workflow usa o caminho fornecido pelo Pages para que o aplicativo instalável e o modo offline funcionem também em um subdiretório. [Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Para transferir seus estudos da prévia local para o site publicado, exporte um backup em **Configurações → Seus dados** na prévia e importe o arquivo no novo endereço.

## Fluxo de estudo

1. Abra **Minha Trilha** para editar fases, disciplinas, módulos, tópicos e atividades. Cadastre um curso próprio adicionando uma disciplina à fase escolhida.
2. Em **Dashboard** ou **Estudar Agora**, selecione 5, 10, 20, 30 ou 60 minutos. As sugestões consideram primeiro sessões interrompidas, depois revisões vencidas, práticas que cabem no tempo disponível e o próximo tópico da trilha. A atividade permanece disponível para outra sessão enquanto houver trabalho a concluir.
3. Durante a sessão, escolha o material aberto e escreva em Markdown. **Chamado chegou!** congela o tempo no instante do clique, registra a sessão e abre **Onde eu parei?** no painel. **Continuar de onde parei** abre o contexto salvo antes de reiniciar o cronômetro.
4. Ao finalizar, escolha explicitamente se o tópico ou a atividade foi concluído. A primeira conclusão de um tópico agenda a revisão. Em **Revisões**, registre a confiança, reagende e crie flashcards ou perguntas. Os intervalos iniciais são de 1, 3, 7, 14 e 30 dias.
5. Personalize tema, dias disponíveis, meta semanal, prioridades, atalhos e avisos em **Configurações**. Consulte o calendário, filtre o histórico e acompanhe o tempo por disciplina em **Estatísticas**. Use **Projetos** para acompanhar práticas e associá-las a tópicos e anotações.
6. Use a busca no topo ou `Ctrl/Cmd + K` para encontrar tópicos, anotações, projetos, materiais e revisões. Durante uma sessão ativa, `Alt + P` aciona a pausa por chamado. Os atalhos podem ser desativados nas preferências.

Se a aba fechar com o cronômetro aberto, a próxima abertura recupera a sessão como pausada até a última marca de tempo. Essa marca é gravada aproximadamente a cada quatro segundos enquanto a aba pode executar, além dos eventos de visibilidade e fechamento atendidos pelo navegador. A pausa explícita registra o instante exato do acionamento. Anotações e pontos de retomada têm uma cópia local temporária enquanto a gravação em IndexedDB está em andamento.

## Backup e privacidade

Em **Configurações → Seus dados**, exporte um arquivo JSON para guardar sua trilha, materiais, histórico, anotações, revisões, projetos e preferências. Guarde o arquivo fora dos dados do navegador se pretender limpar o perfil ou mudar de dispositivo.

A importação valida a estrutura e aplica o backup em uma transação. **Mesclar** mantém as preferências locais e os cadastros de currículo e materiais com o mesmo ID, preserva o progresso mais avançado e resolve os registros datados pela atualização mais recente. **Substituir** aplica o conteúdo do arquivo depois de confirmação. O estudo é local, sem conta e sem telemetria. Evite registrar credenciais, dados corporativos ou informações de chamados reais.

## Arquitetura

| Pasta | Responsabilidade |
|---|---|
| `src/domain` | Tipos, currículo inicial, recomendações e cálculo de tempo por intervalo |
| `src/db` | Esquema Dexie, transações, inicialização e validação de backups |
| `src/features` | Painel, trilha, sessão, caderno, recursos, estatísticas, busca e preferências |
| `src/ui` | Componentes compartilhados, formatação, ciclo do banco e avisos do cronômetro |
| `src/integrations` | Contrato para um futuro provedor de IA opcional. A integração fica inativa nesta versão |
| `public` | Ícones da aplicação instalável |
| `tests` | Testes automatizados de domínio, interface e navegador |

A interface usa React, TypeScript e Tailwind CSS com Vite. Dexie concentra as operações de persistência e o service worker da versão de produção mantém a aplicação disponível offline.

## Testar

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Os testes Vitest usam IndexedDB simulado para verificar alterações do currículo, recomendações, sessões, restauração, anotações, revisões e calendário. Playwright abre a versão de produção na porta 4175 para verificar a pausa por chamado, a retomada após recarregar, a recuperação do cronômetro, o modo offline e os dois modos de importação. Para usar uma instalação existente do Google Chrome no Windows, configure `$env:STUDYOPS_BROWSER_CHANNEL = 'chrome'` antes de executar `pnpm test:e2e`.
