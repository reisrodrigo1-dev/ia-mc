import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VideoAula {
  id: string;
  nome: string;
  professor: string;
  quantidadeBlocos: number;
  dataGravacao?: string;
}

// Função para calcular similaridade entre strings (coeficiente de Jaccard)
function calcularSimilaridade(texto1: string, texto2: string): number {
  const palavras1 = new Set(texto1.toLowerCase().split(/\s+/).filter(p => p.length > 2));
  const palavras2 = new Set(texto2.toLowerCase().split(/\s+/).filter(p => p.length > 2));

  const intersecao = new Set([...palavras1].filter(p => palavras2.has(p)));
  const uniao = new Set([...palavras1, ...palavras2]);

  return intersecao.size / uniao.size;
}

// Função para calcular relevância baseada em tópicos e similaridade
function calcularRelevanciaAula(aulaNome: string, topicosMateria: string[]): number {
  let relevanciaMaxima = 0;

  for (const topico of topicosMateria) {
    // Similaridade direta (se contém palavras-chave)
    const aulaLower = aulaNome.toLowerCase();
    const topicoLower = topico.toLowerCase();

    if (aulaLower.includes(topicoLower) || topicoLower.includes(aulaLower)) {
      return 0.9; // Match exato ou contém o outro
    }

    // Similaridade de Jaccard
    const similaridade = calcularSimilaridade(aulaNome, topico);
    if (similaridade > relevanciaMaxima) {
      relevanciaMaxima = similaridade;
    }

    // Verificar se palavras importantes do tópico estão na aula
    const palavrasTopico = topicoLower.split(/\s+/).filter(p => p.length > 3);
    const palavrasMatch = palavrasTopico.filter(palavra =>
      aulaLower.includes(palavra)
    ).length;

    if (palavrasTopico.length > 0) {
      const porcentagemMatch = palavrasMatch / palavrasTopico.length;
      if (porcentagemMatch > relevanciaMaxima) {
        relevanciaMaxima = porcentagemMatch * 0.8; // Peso menor para match parcial
      }
    }
  }

  return Math.min(relevanciaMaxima, 0.8); // Máximo 80% para similaridade
}

interface MateriaGroup {
  catalogId: string;
  materia: string;
  aulas: VideoAula[];
  totalAulas: number;
  criadoEm: Date;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const catalogId = formData.get('catalogId') as string;

    if (!file || !catalogId) {
      return NextResponse.json({ error: 'Arquivo PDF e ID do catálogo são obrigatórios' }, { status: 400 });
    }

    console.log(`📄 Iniciando análise do PDF: ${file.name}`);

    const buffer = await file.arrayBuffer();

    // Verificar tipo do arquivo
    let textoEdital: string;

    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      // Arquivo de texto
      textoEdital = new TextDecoder().decode(buffer);
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // Por enquanto, retornar erro para PDFs
      return NextResponse.json({
        error: 'Processamento de PDFs ainda não implementado. Use um arquivo de texto (.txt) por enquanto.'
      }, { status: 400 });
    } else {
      return NextResponse.json({
        error: 'Tipo de arquivo não suportado. Use PDF ou arquivo de texto (.txt).'
      }, { status: 400 });
    }

    console.log(`📄 Texto carregado: ${textoEdital.length} caracteres`);

    // Primeiro, buscar as matérias disponíveis no catálogo
    const materiasCatalogo = await buscarMateriasCatalogo(catalogId);
    console.log(`📚 Matérias disponíveis no catálogo:`, materiasCatalogo);

    // Identificar matérias e tópicos usando OpenAI (focando nas matérias do catálogo)
    const analiseIA = await analisarEditalComIA(textoEdital, materiasCatalogo);
    console.log(`🤖 Análise IA concluída: ${analiseIA.materias.length} matérias identificadas`);

    // Buscar aulas relevantes no catálogo
    const recomendacoes = await buscarAulasRecomendadas(catalogId, analiseIA);

    // Calcular estatísticas
    const totalAulasRecomendadas = recomendacoes.reduce((total, materia) => total + materia.aulas.length, 0);
    const materiasCobertas = recomendacoes.length;
    const coberturaPercentual = analiseIA.materias.length > 0
      ? Math.round((materiasCobertas / analiseIA.materias.length) * 100)
      : 0;

    const resultado = {
      editalAnalisado: true,
      materiasEncontradas: analiseIA.materias,
      topicosIdentificados: analiseIA.topicos,
      aulasRecomendadas: recomendacoes,
      estatisticas: {
        totalAulasRecomendadas,
        materiasCobertas,
        coberturaPercentual
      }
    };

    console.log(`✅ Análise concluída: ${totalAulasRecomendadas} aulas recomendadas`);

    return NextResponse.json(resultado);

  } catch (error) {
    console.error('❌ Erro ao analisar edital:', error);
    return NextResponse.json({
      error: 'Erro ao analisar edital',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

async function buscarMateriasCatalogo(catalogId: string): Promise<string[]> {
  try {
    // Buscar documento principal do catálogo
    const catalogDoc = await getDoc(doc(db, 'editais_catalogos', catalogId));

    if (catalogDoc.exists()) {
      const data = catalogDoc.data();
      return data.materias || [];
    }

    return [];
  } catch (error) {
    console.warn('Erro ao buscar matérias do catálogo:', error);
    return [];
  }
}

async function analisarEditalComIA(textoEdital: string, materiasCatalogo: string[]) {
  const prompt = `ANÁLISE COMPLETA E ABRANGENTE DO EDITAL DE CONCURSO PÚBLICO

INSTRUÇÕES IMPORTANTES:
1. Leia TODO o texto do edital ATENTAMENTE - não pule nenhuma seção
2. Identifique TODAS as matérias e áreas de conhecimento mencionadas
3. Procure por BLOCOS DE QUESTÕES, CONTEÚDO PROGRAMÁTICO, DISCIPLINAS, etc.
4. Inclua TODAS as áreas: Língua Portuguesa, Direito, Conhecimentos Gerais, Matemática, Informática, Raciocínio Lógico, Atualidades, etc.
5. IDENTIFIQUE TODAS AS MATÉRIAS MENCIONADAS, INDEPENDENTE DO CATÁLOGO

IMPORTANTE: Este edital pode ter uma estrutura diferente com BLOCOS DE QUESTÕES. Identifique todos os blocos e suas matérias.

MATÉRIAS DISPONÍVEIS NO CATÁLOGO (PARA REFERÊNCIA): ${materiasCatalogo.join(', ')}

ANÁLISE TODO O TEXTO COMPLETO DO EDITAL:
${textoEdital}

TAREFA: Identifique ABSOLUTAMENTE TODAS as matérias, temas e assuntos mencionados no edital que precisam ser estudados.

Procure especificamente por:
- Blocos de questões (BLOCO I, BLOCO II, BLOCO III, etc.)
- Disciplinas mencionadas
- Conteúdo programático
- Áreas de conhecimento
- Matérias específicas

Para os tópicos, extraia diretamente do texto do edital - por exemplo:
- Se o edital diz "BLOCO II: Conhecimentos em Direito" - identifique todas as matérias jurídicas
- Se o edital diz "BLOCO III: Conhecimentos Gerais (atualidades, matemática, informática e raciocínio lógico)" - inclua essas áreas

Retorne TODAS as matérias que aparecem claramente no texto do edital, mesmo que não estejam no catálogo.

Formato de resposta JSON obrigatório:
{
  "materias": ["Direito Constitucional", "Direito Administrativo", "Direito do Trabalho", "Direito Civil", "Direito Penal", "Direito Processual Civil", "Direito Tributário", "Língua Portuguesa", "Matemática", "Informática", "Raciocínio Lógico", "Atualidades"],
  "topicos": {
    "Direito Constitucional": ["Constituição Federal de 1988", "Princípios fundamentais", "Direitos e garantias fundamentais"],
    "Direito Administrativo": ["Administração Pública", "Atos administrativos", "Servidores públicos"],
    "Direito do Trabalho": ["Contrato de trabalho", "Jornada de trabalho", "Sindicato"],
    "Direito Civil": ["Pessoa natural e jurídica", "Obrigações e contratos", "Responsabilidade civil"],
    "Direito Penal": ["Teoria do crime", "Crimes contra a pessoa", "Penas"],
    "Direito Processual Civil": ["Jurisdição e competência", "Processo de conhecimento", "Recursos"],
    "Direito Tributário": ["Sistema tributário nacional", "Impostos", "Obrigação tributária"],
    "Língua Portuguesa": ["Gramática", "Interpretação de texto", "Literatura"],
    "Matemática": ["Álgebra", "Geometria", "Estatística"],
    "Informática": ["Sistemas operacionais", "Planilhas", "Internet"],
    "Raciocínio Lógico": ["Lógica proposicional", "Raciocínio matemático", "Problemas"],
    "Atualidades": ["Política", "Economia", "Sociedade"]
  },
  "prioridades": {
    "Direito Constitucional": 0.9,
    "Direito Administrativo": 0.8,
    "Direito do Trabalho": 0.8,
    "Direito Civil": 0.7,
    "Direito Penal": 0.8,
    "Direito Processual Civil": 0.7,
    "Direito Tributário": 0.6,
    "Língua Portuguesa": 0.7,
    "Matemática": 0.6,
    "Informática": 0.5,
    "Raciocínio Lógico": 0.6,
    "Atualidades": 0.4
  }
}

IMPORTANTE:
- Inclua TODOS os blocos mencionados no edital
- Não ignore nenhuma área de conhecimento
- Retorne TODAS as matérias identificadas, independente do catálogo disponível`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Mais determinístico
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('🤖 Resposta da IA:', content.substring(0, 200) + '...');

    // Limpar a resposta (remover markdown se houver)
    const jsonContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

    const analise = JSON.parse(jsonContent);
    console.log('✅ JSON parseado com sucesso:', analise.materias?.length || 0, 'matérias');
    console.log('📋 Tópicos retornados pela IA:', analise.topicos);
    console.log('🎯 Prioridades retornadas pela IA:', analise.prioridades);

    // Retornar todas as matérias identificadas (não filtrar por catálogo)
    const todasMaterias = analise.materias || [];

    console.log('🎯 Todas as matérias identificadas:', todasMaterias);

    return {
      materias: todasMaterias,
      topicos: analise.topicos || {},
      prioridades: analise.prioridades || {}
    };
  } catch (error) {
    console.warn('❌ Erro na análise IA:', error);
    console.warn('Usando análise básica como fallback');
    // Fallback: extrair matérias básicas do texto
    return extrairMateriasBasicas(textoEdital, materiasCatalogo);
  }
}

function extrairMateriasBasicas(texto: string, materiasCatalogo: string[]) {
  const textoLower = texto.toLowerCase();

  // Usar apenas as matérias que existem no catálogo
  const materiasEncontradas = materiasCatalogo.filter(materia => {
    // Verificar se a matéria aparece no texto (com variações)
    const materiaWords = materia.toLowerCase().split(' ');
    return materiaWords.every(word => textoLower.includes(word));
  });

  console.log(`📋 Análise básica encontrou ${materiasEncontradas.length} matérias do catálogo:`, materiasEncontradas);

  return {
    materias: materiasEncontradas,
    topicos: {},
    prioridades: {}
  };
}

async function buscarAulasRecomendadas(catalogId: string, analiseIA: any) {
  const recomendacoes = [];

  // Primeiro, buscar todas as aulas disponíveis no catálogo
  const todasAulasCatalogo = await buscarTodasAulasCatalogo(catalogId);

  for (const materia of analiseIA.materias) {
    try {
      console.log(`🎯 Buscando aulas para: ${materia}`);

      // Usar IA para fazer matching inteligente entre tópicos e aulas
      const recomendacoesMateria = await matchingInteligenteAulas(
        materia,
        analiseIA.topicos[materia] || [],
        todasAulasCatalogo
      );

      if (recomendacoesMateria.length > 0) {
        recomendacoes.push({
          materia,
          aulas: recomendacoesMateria
        });
      }

    } catch (error) {
      console.warn(`Erro ao buscar aulas para matéria ${materia}:`, error);
    }
  }

  return recomendacoes;
}

// Buscar todas as aulas disponíveis no catálogo
async function buscarTodasAulasCatalogo(catalogId: string): Promise<VideoAula[]> {
  const todasAulas: VideoAula[] = [];

  try {
    // Buscar todos os documentos do catálogo
    const q = query(
      collection(db, 'editais_catalogos'),
      where('catalogId', '==', catalogId)
    );

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.aulas && Array.isArray(data.aulas)) {
        todasAulas.push(...data.aulas);
      }
    });

    console.log(`📚 Encontradas ${todasAulas.length} aulas no catálogo`);
  } catch (error) {
    console.warn('Erro ao buscar aulas do catálogo:', error);
  }

  return todasAulas;
}

// Função de matching inteligente usando IA
async function matchingInteligenteAulas(
  materia: string,
  topicos: string[],
  todasAulas: VideoAula[]
): Promise<VideoAula[]> {

  // Primeiro, fazer um pré-filtro rigoroso: pelo menos uma palavra dos tópicos deve estar presente
  const aulasPreFiltro = preFiltroPalavrasChave(materia, topicos, todasAulas);

  // Se encontrou aulas com palavras-chave, usar essas + algumas adicionais por similaridade
  let aulasCandidatas: VideoAula[];
  if (aulasPreFiltro.length > 0) {
    // Adicionar algumas aulas similares para dar mais opções à IA
    const aulasAdicionais = matchingFallback(materia, topicos, todasAulas)
      .filter(aula => !aulasPreFiltro.some(a => a.id === aula.id)) // Evitar duplicatas
      .slice(0, 10); // Máximo 10 adicionais

    aulasCandidatas = [...aulasPreFiltro, ...aulasAdicionais.map(a => a)]; // Remover propriedade relevancia
  } else {
    // Fallback: usar similaridade se não encontrou palavras-chave
    console.log(`⚠️ Nenhuma aula com palavras-chave para ${materia}, usando similaridade`);
    aulasCandidatas = matchingFallback(materia, topicos, todasAulas).slice(0, 20);
  }

  // Limitar para não exceder o limite de tokens
  const aulasPreFiltradas = aulasCandidatas.slice(0, 50);

  console.log(`🎯 Pré-filtro: ${aulasPreFiltradas.length} aulas candidatas para ${materia} (${aulasPreFiltro.length} com palavras-chave)`);

  if (aulasPreFiltradas.length === 0) {
    console.log(`⚠️ Nenhuma aula pré-filtrada para ${materia}, usando fallback`);
    return matchingFallback(materia, topicos, todasAulas);
  }

  const prompt = `ANÁLISE INTELIGENTE DE COMPATIBILIDADE ENTRE TÓPICOS E VÍDEO AULAS

MATÉRIA: ${materia}
TÓPICOS DO EDITAL: ${topicos.join(', ')}

VÍDEO AULAS CANDIDATAS (pré-selecionadas por palavras-chave e similaridade):
${aulasPreFiltradas.map((aula, index) => `${index + 1}. "${aula.nome}" (ID: ${aula.id})`).join('\n')}

TAREFA: Analise cada vídeo aula candidata e determine quais são mais compatíveis com os TÓPICOS ESPECÍFICOS desta matéria mencionados no edital.

IMPORTANTE: Foque EXCLUSIVAMENTE nos tópicos específicos listados abaixo. Ignore correspondências gerais com a matéria.

TÓPICOS ESPECÍFICOS a serem cobertos:
${topicos.map((topico, index) => `${index + 1}. ${topico}`).join('\n')}

Para cada aula, considere APENAS:
- **Compatibilidade direta com os tópicos específicos acima** (prioridade máxima)
- Conteúdo que ajude especificamente a estudar esses tópicos
- Conceitos diretamente relacionados aos temas listados

Seja MUITO PRECISO no matching:
- Só recomende aulas que realmente ajudem a estudar os tópicos específicos mencionados
- Prefira aulas que abordem exatamente os temas listados
- Evite aulas genéricas que não cubram os tópicos específicos

Retorne um JSON com as aulas mais relevantes, ordenadas por compatibilidade:

{
  "recomendacoes": [
    {
      "aulaNome": "Nome da aula",
      "aulaId": "id_da_aula",
      "compatibilidade": 0.85,
      "justificativa": "Esta aula aborda conceitos fundamentais relacionados aos tópicos X, Y, Z",
      "topicosRelacionados": ["tópico1", "tópico2", "conceitos relacionados"]
    }
  ]
}

Selecione apenas as 5-10 aulas mais relevantes, incluindo aquelas com nomes parecidos ou conceitos relacionados. Compatibilidade deve ser entre 0.1 e 1.0.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    const jsonContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const analise = JSON.parse(jsonContent);

    console.log(`🤖 IA encontrou ${analise.recomendacoes?.length || 0} recomendações para ${materia}`);

    // Converter recomendações em objetos VideoAula com relevância
    const aulasRecomendadas: (VideoAula & { relevancia: number; justificativa: string; topicosRelacionados: string[] })[] = [];

    for (const rec of (analise.recomendacoes || [])) {
      if (rec.compatibilidade > 0.2) { // Mais permissivo para nomes parecidos
        // Encontrar a aula original pelo ID ou nome
        const aulaOriginal = todasAulas.find(a => a.id === rec.aulaId || a.nome === rec.aulaNome);
        if (aulaOriginal) {
          aulasRecomendadas.push({
            ...aulaOriginal,
            relevancia: rec.compatibilidade,
            justificativa: rec.justificativa,
            topicosRelacionados: rec.topicosRelacionados || []
          });
        } else {
          console.warn(`⚠️ Aula não encontrada: ${rec.aulaNome} (ID: ${rec.aulaId})`);
        }
      }
    }

    // Limitar a 8 aulas por matéria
    const aulasFinais = aulasRecomendadas.slice(0, 8);

    console.log(`✅ ${aulasRecomendadas.length} aulas recomendadas para ${materia}`);

    return aulasRecomendadas;

  } catch (error) {
    console.warn(`❌ Erro no matching inteligente para ${materia}:`, error);
    // Fallback: usar o método anterior de similaridade
    return matchingFallback(materia, topicos, todasAulas);
  }
}

// Função de pré-filtro rigoroso: pelo menos uma palavra dos tópicos deve estar no nome da aula
function preFiltroPalavrasChave(materia: string, topicos: string[], todasAulas: VideoAula[]): VideoAula[] {
  // Usar APENAS os tópicos específicos (não usar matéria como backup)
  const palavrasTopicos = topicos.flatMap(topico =>
    topico.toLowerCase().split(' ')
      .filter(palavra => palavra.length > 2) // Ignorar palavras muito curtas
      .map(palavra => palavra.replace(/[^a-zà-ú]/g, '')) // Remover caracteres especiais
  );

  const todasPalavras = palavrasTopicos; // Usar apenas tópicos, sem backup da matéria

  console.log(`🔍 Pré-filtro APENAS tópicos para "${materia}": ${todasPalavras.slice(0, 10).join(', ')}${todasPalavras.length > 10 ? '...' : ''}`);

  const aulasFiltradas = todasAulas.filter(aula => {
    const nomeAula = aula.nome.toLowerCase();
    // Verificar se pelo menos uma palavra dos tópicos ou matéria está presente no nome da aula
    return todasPalavras.some(palavra =>
      nomeAula.includes(palavra) ||
      // Também verificar variações comuns
      nomeAula.includes(palavra.replace('ção', 'cional')) ||
      nomeAula.includes(palavra.replace('cional', 'ção')) ||
      nomeAula.includes(palavra.replace('tica', 'tico')) ||
      nomeAula.includes(palavra.replace('tico', 'tica'))
    );
  });

  console.log(`✅ Pré-filtro encontrou ${aulasFiltradas.length} aulas com palavras dos tópicos para ${materia}`);
  return aulasFiltradas;
}

// Fallback para quando a IA falhar
function matchingFallback(materia: string, topicos: string[], todasAulas: VideoAula[]): (VideoAula & { relevancia: number })[] {
  console.log(`🔄 Usando método fallback para ${materia}`);

  const aulasComRelevancia = todasAulas.map(aula => {
    const relevanciaTopicos = calcularRelevanciaAula(aula.nome, topicos);
    const prioridadeMateria = 0.7; // Prioridade padrão
    const relevancia = Math.min(relevanciaTopicos * prioridadeMateria, 0.8);

    return {
      ...aula,
      relevancia
    };
  });

  return aulasComRelevancia
    .filter(aula => aula.relevancia > 0.2)
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, 5);
}