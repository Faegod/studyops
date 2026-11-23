import type { CurriculumNode, Material, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'local',
  weeklyGoal: 5,
  availableDays: [1, 2, 3, 4, 5],
  defaultMinutes: 20,
  theme: 'light',
  notifications: false,
  shortcuts: true,
  priorityIds: [],
}

export const seedMaterials: Material[] = [
  { id: 'cs50', title: 'CS50x · Semana 0: Scratch', url: 'https://cs50.harvard.edu/x/weeks/0/', source: 'Harvard CS50', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Computação' },
  { id: 'cs50-memory', title: 'CS50x · Semana 4: Memória', url: 'https://cs50.harvard.edu/x/weeks/4/', source: 'Harvard CS50', type: 'curso', language: 'Inglês', difficulty: 'intermediário', subject: 'Computação' },
  { id: 'cisco-networking', title: 'Networking Basics', url: 'https://www.netacad.com/courses/networking-basics', source: 'Cisco Networking Academy', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Redes' },
  { id: 'cisco-security', title: 'Introduction to Cybersecurity', url: 'https://www.netacad.com/courses/introduction-to-cybersecurity', source: 'Cisco Networking Academy', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Cibersegurança' },
  { id: 'ms-ad', title: 'Active Directory Domain Services', url: 'https://learn.microsoft.com/pt-br/training/paths/active-directory-domain-services/', source: 'Microsoft Learn', type: 'curso', language: 'Português', difficulty: 'intermediário', subject: 'Windows Server' },
  { id: 'ms-powershell', title: 'Introdução ao PowerShell', url: 'https://learn.microsoft.com/pt-br/powershell/scripting/learn/ps101/01-getting-started', source: 'Microsoft Learn', type: 'documentação', language: 'Português', difficulty: 'iniciante', subject: 'PowerShell' },
  { id: 'ms-hyper-v', title: 'Virtualização com Hyper-V', url: 'https://learn.microsoft.com/pt-br/windows-server/virtualization/hyper-v/overview', source: 'Microsoft Learn', type: 'documentação', language: 'Português', difficulty: 'iniciante', subject: 'Virtualização' },
  { id: 'ms-cloud', title: 'Conceitos de computação em nuvem', url: 'https://learn.microsoft.com/pt-br/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/', source: 'Microsoft Learn', type: 'curso', language: 'Português', difficulty: 'iniciante', subject: 'Cloud' },
  { id: 'linux-foundation', title: 'Introduction to Linux (LFS101)', url: 'https://training.linuxfoundation.org/training/introduction-to-linux/', source: 'Linux Foundation', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Linux' },
  { id: 'pro-git', title: 'Pro Git · Recording Changes to the Repository', url: 'https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository', source: 'Git', type: 'livro', language: 'Inglês', difficulty: 'iniciante', subject: 'Git' },
  { id: 'cev-python', title: 'Python 3 – Mundo 1', url: 'https://www.cursoemvideo.com/curso/python-3-mundo-1/', source: 'Curso em Vídeo', type: 'curso', language: 'Português', difficulty: 'iniciante', subject: 'Python' },
  { id: 'python-docs', title: 'O tutorial do Python', url: 'https://docs.python.org/pt-br/3/tutorial/', source: 'Python Software Foundation', type: 'documentação', language: 'Português', difficulty: 'intermediário', subject: 'Python' },
  { id: 'fcc-web', title: 'Responsive Web Design', url: 'https://www.freecodecamp.org/learn/responsive-web-design-v9', source: 'freeCodeCamp', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Desenvolvimento web' },
  { id: 'mdn-http', title: 'Uma visão geral do HTTP', url: 'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Overview', source: 'MDN Web Docs', type: 'documentação', language: 'Português', difficulty: 'iniciante', subject: 'APIs' },
  { id: 'postgres', title: 'Tutorial de SQL do PostgreSQL', url: 'https://www.postgresql.org/docs/current/tutorial-sql.html', source: 'PostgreSQL', type: 'documentação', language: 'Inglês', difficulty: 'iniciante', subject: 'Bancos de dados' },
  { id: 'docker', title: 'Get started with Docker containers', url: 'https://docs.docker.com/learn/paths/get-started-with-docker-containers/', source: 'Docker', type: 'curso', language: 'Inglês', difficulty: 'iniciante', subject: 'Contêineres' },
  { id: 'google-ml', title: 'Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', source: 'Google for Developers', type: 'curso', language: 'Inglês', difficulty: 'intermediário', subject: 'Inteligência artificial' },
]

type TopicSeed = [
  id: string,
  title: string,
  minutes: number,
  description: string,
  objective: string,
  materials: string[],
  practice: string,
  practiceMinutes: number,
  prerequisite?: string,
]

interface DisciplineSeed {
  title: string
  modules: { title: string; topics: TopicSeed[] }[]
}

interface PhaseSeed {
  id: string
  title: string
  weeks: number
  description: string
  disciplines: DisciplineSeed[]
}

const phases: PhaseSeed[] = [
  {
    id: 'fundamentos', title: 'Fundamentos da computação', weeks: 4,
    description: 'Entenda como computadores representam dados, executam programas e gerenciam recursos.',
    disciplines: [
      { title: 'Computação essencial', modules: [
        { title: 'Hardware e dados', topics: [
          ['arquitetura', 'Arquitetura de computadores', 30, 'Entenda o papel do processador, da memória, do armazenamento e dos dispositivos de entrada e saída.', 'Explique o caminho de uma instrução e diferencie memória RAM de armazenamento.', ['cs50-memory'], 'Faça um desenho ligando CPU, memória, armazenamento e dispositivos de entrada e saída.', 5],
          ['representacao', 'Representação de dados', 20, 'Explore como bits representam números, caracteres e imagens.', 'Converta números pequenos entre as bases decimal e binária.', ['cs50'], 'Converta 13 e 42 para binário e explique a diferença entre bit e byte.', 10, 'Arquitetura de computadores'],
        ] },
        { title: 'Sistemas e resolução de problemas', topics: [
          ['sistemas', 'Sistemas operacionais e processos', 30, 'Relacione processos, arquivos e recursos às tarefas de um sistema operacional.', 'Identifique um processo e interprete seu uso de CPU e memória.', ['linux-foundation'], 'Observe um aplicativo no monitor de processos do computador pessoal e registre seu consumo de memória.', 10, 'Arquitetura de computadores'],
          ['algoritmos', 'Pensamento algorítmico', 30, 'Use decomposição, abstração e pseudocódigo para descrever procedimentos.', 'Escreva e teste um procedimento com pelo menos uma decisão.', ['cs50'], 'Escreva um procedimento de diagnóstico para um equipamento fictício e simule dois resultados.', 20],
        ] },
      ] },
    ],
  },
  {
    id: 'redes', title: 'Redes de computadores', weeks: 6,
    description: 'Aprenda a explicar a comunicação entre dispositivos e a diagnosticar conectividade em laboratório.',
    disciplines: [{ title: 'Conectividade e diagnóstico', modules: [
      { title: 'Comunicação em redes', topics: [
        ['camadas', 'Camadas de rede e Ethernet', 30, 'Relacione endereços físicos e lógicos às camadas de rede.', 'Diferencie quadro, pacote e segmento em um exemplo simples.', ['cisco-networking'], 'Desenhe a comunicação entre dois dispositivos ligados a um switch em uma rede local.', 10],
        ['enderecos', 'Endereçamento IPv4 e sub-redes', 60, 'Leia endereços IPv4, máscaras CIDR e gateways padrão.', 'Determine se dois endereços de exemplo pertencem à mesma sub-rede.', ['cisco-networking'], 'Calcule rede, broadcast e intervalo de hosts para 192.168.50.0/27.', 20, 'Camadas de rede e Ethernet'],
      ] },
      { title: 'Serviços de rede', topics: [
        ['dns-dhcp', 'DNS, DHCP e roteamento', 30, 'Entenda como dispositivos obtêm um endereço, descobrem nomes e alcançam outras redes.', 'Explique a diferença entre uma falha de DNS, uma falha de DHCP e uma rota ausente.', ['cisco-networking'], 'Crie uma tabela com três sintomas fictícios e qual serviço você verificaria primeiro.', 10, 'Endereçamento IPv4 e sub-redes'],
        ['diagnostico-rede', 'Diagnóstico de conectividade', 30, 'Use observações do próprio laboratório para testar hipóteses de conectividade.', 'Diferencie problemas de configuração local e de resolução de nomes.', ['cisco-networking'], 'Registre os resultados de ipconfig ou ip addr e faça um ping ao gateway do laboratório pessoal.', 20, 'DNS, DHCP e roteamento'],
      ] },
    ] }],
  },
  {
    id: 'servidores', title: 'Windows Server e Linux', weeks: 8,
    description: 'Pratique administração de sistemas, identidades e serviços em máquinas de laboratório.',
    disciplines: [
      { title: 'Administração Windows', modules: [{ title: 'Windows Server e diretório', topics: [
        ['windows-server', 'Funções e serviços do Windows Server', 30, 'Explore como funções de servidor, logs e ferramentas de gerenciamento se relacionam.', 'Distinga funções de servidor de recursos opcionais.', ['ms-ad'], 'Liste as funções que um pequeno escritório fictício precisaria e a finalidade de cada uma.', 10, 'Diagnóstico de conectividade'],
        ['active-directory', 'Active Directory, grupos e GPO', 60, 'Entenda domínios, unidades organizacionais, contas, grupos e políticas.', 'Modele grupos e permissões com base em papéis de trabalho fictícios.', ['ms-ad'], 'Desenhe unidades organizacionais e grupos para dois departamentos fictícios.', 20, 'Funções e serviços do Windows Server'],
      ] }] },
      { title: 'Administração Linux', modules: [{ title: 'Operação de sistemas Linux', topics: [
        ['linux-arquivos', 'Linux: arquivos, usuários e permissões', 30, 'Pratique navegação, propriedade e permissões de arquivos em um ambiente pessoal.', 'Interprete permissões de leitura, escrita e execução para dono, grupo e outros.', ['linux-foundation'], 'Em um diretório de teste, crie um arquivo, restrinja sua leitura e confira as permissões.', 20],
        ['linux-servicos', 'Linux: processos, serviços e logs', 30, 'Identifique processos, serviços gerenciados pelo sistema e eventos de logs.', 'Use os logs para explicar o estado de um serviço de laboratório.', ['linux-foundation'], 'Localize um serviço no seu laboratório e encontre a data de sua última inicialização nos logs.', 20, 'Linux: arquivos, usuários e permissões'],
      ] }] },
    ],
  },
  {
    id: 'ferramentas', title: 'Terminal, PowerShell e Git', weeks: 4,
    description: 'Use o terminal para operações repetíveis e versionamento de automações.',
    disciplines: [{ title: 'Linha de comando e versionamento', modules: [
      { title: 'Terminais e automação', topics: [
        ['terminal', 'Navegação, arquivos e redirecionamento', 20, 'Pratique caminhos relativos e absolutos, argumentos e fluxo de entrada e saída.', 'Combine uma listagem segura com um filtro de saída em uma pasta de prática.', ['linux-foundation'], 'Crie uma pasta de testes e grave a listagem dos arquivos em um relatório de texto.', 10],
        ['powershell', 'PowerShell e pipeline de objetos', 30, 'Explore comandos, ajuda interativa e filtragem de objetos.', 'Distinga um objeto do texto produzido ao exibi-lo no console.', ['ms-powershell'], 'Liste os cinco processos com maior consumo de CPU acumulado no seu computador pessoal.', 20, 'Navegação, arquivos e redirecionamento'],
      ] },
      { title: 'Controle de versão', topics: [
        ['git-commits', 'Git: repositório, estágio e commits', 30, 'Acompanhe mudanças no diretório de trabalho, na área de estágio e no histórico.', 'Crie um histórico pequeno de alterações com mensagens claras.', ['pro-git'], 'Crie um repositório local com README e faça dois commits descritivos.', 20, 'Navegação, arquivos e redirecionamento'],
        ['git-branches', 'Git: branches e integração', 30, 'Isole mudanças de uma tarefa e compreenda como são incorporadas ao trabalho principal.', 'Compare duas branches e interprete um conflito simples.', ['pro-git'], 'Em um repositório de prática, faça uma alteração em uma branch e integre-a à principal.', 20, 'Git: repositório, estágio e commits'],
      ] },
    ] }],
  },
  {
    id: 'python', title: 'Programação com Python', weeks: 8,
    description: 'Escreva programas pequenos e evolua para automações com arquivos, tratamento de erros e testes.',
    disciplines: [{ title: 'Python aplicado', modules: [
      { title: 'Lógica e estruturas de dados', topics: [
        ['python-tipos', 'Tipos, variáveis e operações', 30, 'Use números, strings e expressões para representar dados e produzir saídas.', 'Preveja resultados de operações com números e strings.', ['cev-python', 'python-docs'], 'Implemente uma conversão de minutos para horas e minutos restantes.', 10],
        ['python-controle', 'Condicionais, laços e coleções', 60, 'Percorra listas e dicionários e aplique critérios para produzir classificações.', 'Use uma decisão e uma iteração na mesma tarefa.', ['cev-python', 'python-docs'], 'Conte os itens de uma lista fictícia por categoria e imprima o resumo.', 20, 'Tipos, variáveis e operações'],
      ] },
      { title: 'Automação confiável', topics: [
        ['python-funcoes', 'Funções, módulos e erros', 30, 'Divida uma rotina em funções e trate entradas inadequadas.', 'Identifique quais erros devem ser tratados em uma função.', ['python-docs'], 'Escreva e teste uma função que valida uma duração positiva em minutos.', 20, 'Condicionais, laços e coleções'],
        ['python-arquivos', 'Arquivos, JSON e testes', 60, 'Leia e grave dados estruturados e comprove comportamentos esperados.', 'Produza um relatório local a partir de dados JSON válidos e inválidos.', ['python-docs'], 'Crie um arquivo JSON fictício e teste uma função que resume os registros por categoria.', 30, 'Funções, módulos e erros'],
      ] },
    ] }],
  },
  {
    id: 'web-dados', title: 'Bancos de dados, APIs e desenvolvimento web', weeks: 4,
    description: 'Trabalhe dados relacionais e conecte interfaces aos conceitos de HTTP e APIs.',
    disciplines: [
      { title: 'Bancos relacionais', modules: [{ title: 'Modelagem e SQL', topics: [
        ['relacional', 'Modelagem relacional', 30, 'Modele entidades, chaves, atributos e relacionamentos.', 'Traduza um requisito simples em duas tabelas relacionadas.', ['postgres'], 'Esboce tabelas para cursos e tópicos, com suas chaves e restrições.', 10],
        ['sql', 'Consultas SQL e junções', 60, 'Selecione, filtre e agregue registros de tabelas relacionais.', 'Use SELECT, WHERE, JOIN e GROUP BY em um conjunto pequeno.', ['postgres'], 'Escreva uma consulta que conta tópicos por curso e valide com três registros fictícios.', 20, 'Modelagem relacional'],
      ] }] },
      { title: 'Web e integração', modules: [{ title: 'Interfaces e HTTP', topics: [
        ['http', 'HTTP, JSON e APIs', 30, 'Leia uma troca HTTP e entenda os papéis de métodos, status, cabeçalhos e corpo.', 'Descreva um contrato simples para consultar uma coleção de itens.', ['mdn-http'], 'Defina em texto uma resposta JSON e os status esperados de uma API fictícia de cursos.', 10],
        ['web-interface', 'HTML e CSS responsivos', 60, 'Estruture uma página com semântica e adapte o layout a telas menores.', 'Crie uma página com hierarquia de títulos e navegação por teclado.', ['fcc-web'], 'Monte uma página responsiva que exibe uma pequena lista de estudos fictícia.', 30, 'HTTP, JSON e APIs'],
      ] }] },
    ],
  },
  {
    id: 'infra-cloud', title: 'Virtualização, Docker e Cloud', weeks: 8,
    description: 'Compare máquinas virtuais, contêineres e serviços de nuvem por isolamento e responsabilidades.',
    disciplines: [{ title: 'Infraestrutura moderna', modules: [
      { title: 'Ambientes isolados', topics: [
        ['virtualizacao', 'Máquinas virtuais e hipervisores', 30, 'Entenda a divisão de recursos do host e o isolamento entre convidados.', 'Distingua imagem, máquina virtual e ponto de restauração.', ['ms-hyper-v'], 'Planeje em papel uma VM Linux para laboratório, com RAM, disco e rede definidos.', 10],
        ['containers', 'Imagens, contêineres e volumes', 60, 'Identifique a origem de uma imagem e o ciclo de vida de um contêiner e seus dados.', 'Descreva como dados em volumes podem sobreviver à recriação de um contêiner.', ['docker'], 'No computador pessoal, execute um contêiner de exemplo oficial e registre seu ciclo de vida.', 20, 'Máquinas virtuais e hipervisores'],
        ['compose', 'Serviços com Docker Compose', 60, 'Descreva uma aplicação local como um conjunto de serviços, redes e volumes.', 'Interprete o mapa de serviços e identifique onde cada serviço persiste dados.', ['docker'], 'Use o exemplo oficial do Docker Compose em laboratório e desenhe as relações entre serviços.', 30, 'Imagens, contêineres e volumes'],
      ] },
      { title: 'Computação em nuvem', topics: [
        ['cloud', 'Modelos de nuvem e responsabilidade compartilhada', 30, 'Compare IaaS, PaaS e SaaS e os limites de responsabilidade.', 'Classifique uma carga de trabalho por modelo e identifique quem a opera.', ['ms-cloud'], 'Desenhe uma matriz de responsabilidades para uma aplicação pessoal em IaaS e PaaS.', 20, 'Máquinas virtuais e hipervisores'],
      ] },
    ] }],
  },
  {
    id: 'exploracao', title: 'Exploração profissional: software, infraestrutura, cibersegurança e IA', weeks: 8,
    description: 'Experimente tarefas representativas de quatro áreas e registre evidências para orientar sua escolha.',
    disciplines: [{ title: 'Experimentação profissional', modules: [
      { title: 'Software e infraestrutura', topics: [
        ['carreira-software', 'Software: da necessidade à entrega', 60, 'Experimente definir um requisito, testar uma solução e documentar como alguém pode usá-la.', 'Apresente um programa pequeno com critérios de aceitação verificáveis.', ['python-docs', 'pro-git'], 'Documente uma automação pessoal com exemplos, testes e instruções de execução.', 30, 'Arquivos, JSON e testes'],
        ['carreira-infra', 'Infraestrutura: operação e recuperação', 60, 'Experimente inventariar dependências, definir monitoramento e preparar recuperação.', 'Produza um procedimento de recuperação verificável para um serviço local.', ['docker', 'ms-cloud'], 'Simule a restauração dos dados de uma aplicação pessoal descartável e registre o resultado.', 30, 'Serviços com Docker Compose'],
      ] },
      { title: 'Cibersegurança defensiva e IA', topics: [
        ['carreira-seguranca', 'Cibersegurança: proteção e resposta', 30, 'Estude privilégio mínimo, autenticação multifator, cópias de segurança e resposta a incidentes simulados.', 'Priorize controles defensivos para um cenário de trabalho fictício.', ['cisco-security'], 'Monte um checklist de proteção e recuperação para uma equipe fictícia de suporte.', 20],
        ['carreira-ia', 'IA: dados, avaliação e limites', 60, 'Explore a diferença entre treinamento e avaliação e como medir erros em dados separados.', 'Explique por que medir apenas nos dados de treino pode ocultar problemas.', ['google-ml'], 'Compare previsões de um classificador simples em dados sintéticos com um palpite de referência.', 30, 'Condicionais, laços e coleções'],
      ] },
    ] }],
  },
]

function node(
  id: string,
  kind: CurriculumNode['kind'],
  parentId: string | null,
  order: number,
  title: string,
  overrides: Partial<CurriculumNode> = {},
): CurriculumNode {
  return {
    id, kind, parentId, order, title,
    description: '',
    status: 'pending',
    minutes: 20,
    difficulty: 'iniciante',
    objectives: [],
    prerequisites: [],
    materialIds: [],
    ...overrides,
  }
}

export const seedNodes: CurriculumNode[] = phases.flatMap((phase, phaseIndex) => {
  const phaseId = `phase-${phase.id}`
  return [
    node(phaseId, 'phase', null, phaseIndex, phase.title, { description: phase.description, weeks: phase.weeks }),
    ...phase.disciplines.flatMap((discipline, disciplineIndex) => {
      const disciplineId = `${phaseId}-d${disciplineIndex + 1}`
      return [
        node(disciplineId, 'discipline', phaseId, disciplineIndex, discipline.title),
        ...discipline.modules.flatMap((module, moduleIndex) => {
          const moduleId = `${disciplineId}-m${moduleIndex + 1}`
          return [
            node(moduleId, 'module', disciplineId, moduleIndex, module.title),
            ...module.topics.flatMap((topic, topicIndex) => {
              const [id, title, minutes, description, objective, materialIds, practice, practiceMinutes, prerequisite] = topic
              const topicId = `topic-${id}`
              const details = {
                difficulty: minutes >= 60 ? 'intermediário' as const : 'iniciante' as const,
                prerequisites: prerequisite ? [prerequisite] : [],
                materialIds,
              }
              return [
                node(topicId, 'topic', moduleId, topicIndex, title, { ...details, minutes, description, objectives: [objective] }),
                node(`activity-${id}`, 'activity', topicId, 0, `Prática · ${title}`, { ...details, minutes: practiceMinutes, description: practice, objectives: [objective] }),
              ]
            }),
          ]
        }),
      ]
    }),
  ]
})
