import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';

// Mapeamento de palavras-chave para matérias
const MATERIAS_KEYWORDS: Record<string, string[]> = {
  'Direito Constitucional': [
    'constitucional', 'federal', 'organização', 'poderes', 'nacionalidade',
    'funções essenciais', 'direitos fundamentais', 'ações constitucionais',
    'intervenção federal', 'organização dos poderes'
  ],
  'Direito do Trabalho': [
    'trabalho', 'jornada', 'contrato', 'cessação', 'vínculo', 'estabelecidades',
    'alteração', 'modalidade', 'trabalhista'
  ],
  'Direito Profissional': [
    'advogado', 'publicidade', 'impedimento', 'inacumulabilidade',
    'profissional', 'ética'
  ],
  'Direito Administrativo': [
    'administrativo', 'administração', 'atos administrativos', 'servidor público',
    'licitação', 'contrato administrativo', 'processo administrativo'
  ],
  'Direito Civil': [
    'civil', 'obrigação', 'contrato civil', 'responsabilidade civil',
    'pessoa jurídica', 'bem', 'propriedade'
  ],
  'Direito Penal': [
    'penal', 'crime', 'pena', 'processo penal', 'infração penal'
  ],
  'Direito Processual Civil': [
    'processual civil', 'cpc', 'ação', 'processo civil', 'jurisdição'
  ],
  'Direito Tributário': [
    'tributário', 'imposto', 'tributo', 'contribuição', 'fiscal'
  ],
  'Direito Previdenciário': [
    'previdenciário', 'previdência', 'inss', 'aposentadoria', 'benefício'
  ],
  'Direito Empresarial': [
    'empresarial', 'empresa', 'sociedade', 'falência', 'recuperação'
  ],
  'Direito Internacional': [
    'internacional', 'tratado', 'convenção', 'direito internacional'
  ],
  'Direito Ambiental': [
    'ambiental', 'meio ambiente', 'poluição', 'sustentabilidade'
  ],
  'Direito do Consumidor': [
    'consumidor', 'cdc', 'consumo', 'fornecedor'
  ],
  'Ética Profissional': [
    'ética', 'deontologia', 'princípios éticos', 'código de ética'
  ],
  'Língua Portuguesa': [
    'português', 'portuguesa', 'língua portuguesa', 'gramática', 'literatura',
    'interpretação', 'texto', 'redação', 'ortografia', 'morfologia', 'sintaxe'
  ],
  'Matemática': [
    'matemática', 'álgebra', 'geometria', 'estatística', 'cálculo',
    'probabilidade', 'aritmética', 'matemático'
  ],
  'Informática': [
    'informática', 'computador', 'software', 'hardware', 'internet',
    'sistema operacional', 'planilha', 'word', 'excel', 'powerpoint'
  ],
  'Raciocínio Lógico': [
    'lógico', 'raciocínio', 'lógica', 'proposicional', 'dedução', 'indução',
    'silogismo', 'argumentação', 'pensamento crítico'
  ],
  'Atualidades': [
    'atualidades', 'notícias', 'política', 'economia', 'sociedade',
    'acontecimentos', 'fatos atuais', 'atual'
  ],
  'Conhecimentos Gerais': [
    'gerais', 'conhecimentos gerais', 'cultura geral', 'conhecimentos básicos'
  ],
  'Outras Matérias': [] // Fallback
};

function identificarMateria(nomeAula: string): string {
  // Limpar caracteres corrompidos de encoding
  const nomeLimpo = nomeAula
    .replace(/Ã£/g, 'ã')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã¢/g, 'â')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã\x83Ã\x87/g, 'Ç')
    .replace(/Ã\x83Ã\x83O/g, 'ÇÃO')
    .replace(/Ã\x87Ã\x83O/g, 'ÇÃO');

  const nomeLower = nomeLimpo.toLowerCase();

  console.log(`🔍 Categorizando aula: "${nomeAula}" -> "${nomeLimpo}"`);

  for (const [materia, keywords] of Object.entries(MATERIAS_KEYWORDS)) {
    const match = keywords.some(keyword => nomeLower.includes(keyword));
    if (match) {
      console.log(`✅ Match encontrado: "${materia}" (palavra-chave: ${keywords.find(k => nomeLower.includes(k))})`);
      return materia;
    }
  }

  console.log(`❌ Nenhuma categoria encontrada, usando "Outras Matérias"`);
  return 'Outras Matérias';
}

interface VideoAula {
  id: string;
  nome: string;
  professor: string;
  dataGravacao?: string;
  quantidadeBlocos: number;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 });
    }

    console.log(`📊 Iniciando processamento do arquivo: ${file.name}`);

    // Ler arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converter para JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

    console.log(`📊 Lendo ${rawData.length} linhas do Excel...`);

    // Processar e agrupar por matéria
    const { catalogData, materiaGroups } = processVideoAulas(rawData);

    // Criar ID único para o catálogo
    const catalogId = `catalogo_${Date.now()}`;

    console.log(`📁 Criando catálogo: ${catalogId}`);

    // Salvar documento principal (metadados)
    const catalogDoc: any = {
      id: catalogId,
      nome: catalogData.nome,
      totalAulas: catalogData.totalAulas,
      totalMaterias: catalogData.totalMaterias,
      materias: catalogData.materias,
      criadoEm: new Date(),
      connectionId: 'default'
    };

    await setDoc(doc(db, 'editais_catalogos', catalogId), catalogDoc);

    console.log(`📁 Salvando catálogo principal: ${catalogId}`);

    // Salvar grupos de matérias (múltiplos documentos por matéria se necessário)
    const savePromises: Promise<void>[] = [];

    for (const [materia, aulas] of Object.entries(materiaGroups)) {
      const materiaId = `${catalogId}_${materia.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

      console.log(`📝 Salvando matéria: ${materia} (${aulas.length} aulas)`);

      // Filtrar campos undefined das aulas
      const aulasFiltradas = aulas.map(aula => {
        const aulaFiltrada: any = {
          id: aula.id,
          nome: aula.nome,
          professor: aula.professor,
          quantidadeBlocos: aula.quantidadeBlocos
        };

        if (aula.dataGravacao) {
          aulaFiltrada.dataGravacao = aula.dataGravacao;
        }

        return aulaFiltrada;
      });

      // Dividir aulas em chunks de no máximo 500 aulas por documento
      const CHUNK_SIZE = 500;
      const chunks = [];

      for (let i = 0; i < aulasFiltradas.length; i += CHUNK_SIZE) {
        chunks.push(aulasFiltradas.slice(i, i + CHUNK_SIZE));
      }

      console.log(`📦 Dividindo ${aulas.length} aulas em ${chunks.length} documentos`);

      // Salvar cada chunk como um documento separado
      chunks.forEach((chunk, index) => {
        const chunkId = chunks.length > 1 ? `${materiaId}_part${index + 1}` : materiaId;

        const materiaDoc = {
          catalogId,
          materia,
          chunkIndex: index,
          totalChunks: chunks.length,
          aulas: chunk,
          totalAulas: aulas.length,
          criadoEm: new Date()
        };

        savePromises.push(setDoc(doc(db, 'editais_catalogos', chunkId), materiaDoc));
      });
    }

    await Promise.all(savePromises);

    console.log(`✅ ${savePromises.length} grupos de matérias salvos`);

    return NextResponse.json({
      success: true,
      catalogId,
      resumo: {
        totalAulas: catalogData.totalAulas,
        materias: catalogData.materias,
        aulasPorMateria: Object.entries(materiaGroups).map(([materia, aulas]) => ({
          materia,
          quantidade: aulas.length
        }))
      },
      message: `Catálogo criado com sucesso! ${catalogData.totalAulas} aulas organizadas em ${catalogData.totalMaterias} matérias.`
    });

  } catch (error) {
    console.error('❌ Erro ao processar Excel:', error);
    return NextResponse.json({
      error: 'Erro ao processar arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

function processVideoAulas(rawData: any[]) {
  const materiaGroups: Record<string, VideoAula[]> = {};
  let totalAulas = 0;

  console.log('📊 Dados brutos do Excel (primeiras 3 linhas):', rawData.slice(0, 3));
  console.log('📊 Colunas detectadas na primeira linha:', Object.keys(rawData[0] || {}));

  // Processar cada linha do Excel
  rawData.forEach((row, index) => {
    try {
      console.log(`🔍 Linha ${index + 1} - Propriedades disponíveis:`, Object.keys(row));
      console.log(`🔍 Linha ${index + 1} - Valores das propriedades:`, row);

      // Extrair nome da aula - tentar nomes comuns de colunas
      const nomeRaw = row['Nome da Aula'] || row['NOME DA AULA'] || row['Nome da aula'] || row['nome da aula'] ||
                     row['Nome'] || row['NOME'] || row['Nome_Aula'] || row['nome_aula'] ||
                     row.NOME_AULA || row.nome_aula || row.NOME || row.nome ||
                     row.TITULO || row.titulo || row.TÍTULO || row.título ||
                     row.AULA || row.aula || row.TEMA || row.tema ||
                     row.CONTEUDO || row.conteudo || row.CONTEÚDO || row.conteúdo ||
                     row.DESCRICAO || row.descricao || row.DESCRIÇÃO || row.descrição ||
                     row.ASSUNTO || row.assunto || '';

      const nome = typeof nomeRaw === 'string' && nomeRaw.trim() !== '' ? nomeRaw.trim() :
                   typeof nomeRaw === 'number' ? String(nomeRaw) :
                   `Aula ${index + 1}`;

      // Extrair professor - tentar nomes comuns
      const professorRaw = row['Professor'] || row['PROFESSOR'] || row['Nome do Professor'] || row['NOME DO PROFESSOR'] ||
                          row.PROFESSOR || row.professor || row.INSTRUTOR || row.instrutor ||
                          row.DOCENTE || row.docente || row.PALESTRANTE || row.palestrante ||
                          row.MINISTRANTE || row.ministrante || '';

      const professor = typeof professorRaw === 'string' && professorRaw.trim() !== '' ? professorRaw.trim() :
                       typeof professorRaw === 'number' ? String(professorRaw) :
                       'Professor não informado';

      // Extrair data
      const dataRaw = row['Data de Gravação'] || row['DATA DE GRAVAÇÃO'] || row['Data de Gravacao'] || row['data de gravacao'] ||
                     row['Data'] || row['DATA'] || row.DATA_GRAVAÇÃO || row.data_gravacao ||
                     row.DATA_GRAVACAO || row.data_gravacao || row.DATA || row.data ||
                     row.DATA_AULA || row.data_aula || row.DATA_REGISTRO || row.data_registro || undefined;

      const aula: VideoAula = {
        id: String(row['ID'] || row['Id'] || row['id'] || row['Código'] || row['CODIGO'] || row['Código da Aula'] ||
                  row.ID_AULA || row.id_aula || row.ID || row.id || row.CODIGO || row.codigo || index + 1),
        nome: nome,
        professor: professor,
        dataGravacao: dataRaw,
        quantidadeBlocos: Number(row['Quantidade de Blocos'] || row['QUANTIDADE DE BLOCOS'] || row['Qtd Blocos'] || row['QTD BLOCOS'] ||
                                row.QUANTIDA_BLOCOS || row.quantidade_blocos || row.QUANTIDADE_BLOCOS ||
                                row.QTD_BLOCOS || row.qtd_blocos || row.BLOCOS || row.blocos ||
                                row.DURACAO || row.duracao || row.DURAÇÃO || row.duração || 1)
      };

      console.log(`✅ Aula ${index + 1} FINAL: ID="${aula.id}", Nome="${aula.nome}", Professor="${aula.professor}"`);

      // Só processar aulas que têm pelo menos algum identificador
      if (aula.nome && aula.nome.trim() !== '') {
        const materia = identificarMateria(aula.nome);

        if (!materiaGroups[materia]) {
          materiaGroups[materia] = [];
        }

        materiaGroups[materia].push(aula);
        totalAulas++;
      } else {
        console.warn(`⚠️ Aula ${index + 1} pulada - nome vazio ou null`);
      }

    } catch (error) {
      console.warn(`⚠️ Erro ao processar linha ${index + 1}:`, error);
    }
  });

  console.log('📋 Distribuição final por matéria:', Object.entries(materiaGroups).map(([materia, aulas]) => `${materia}: ${aulas.length} aulas`));

  const catalogData = {
    nome: 'Catálogo de Vídeo Aulas',
    totalAulas,
    totalMaterias: Object.keys(materiaGroups).length,
    materias: Object.keys(materiaGroups),
    criadoEm: new Date()
  };

  return { catalogData, materiaGroups };
}
