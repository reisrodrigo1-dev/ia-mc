# 📚 Sistema de Análise de Editais - Guia de Uso

## ✅ O que foi implementado:

### 1. **Menu EDITAIS**
No sidebar do dashboard, você encontrará um novo menu dropdown "Editais" com 3 opções:

- **📤 Upload de Vídeo Aulas**: Importar catálogo de vídeo aulas do Excel
- **🔍 Analisar Edital**: (Em construção)
- **📋 Meus Editais**: (Em construção)

---

## 🚀 Como Usar:

### **Passo 1: Upload do Catálogo de Vídeo Aulas**

1. Acesse: **Dashboard > Editais > Upload de Vídeo Aulas**

2. **Formato do Excel esperado:**
   ```
   | ID_AULA | NOME_AULA | DATA_GRAVAÇÃO | QUANTIDA_BLOCOS | PROFESSOR |
   |---------|-----------|---------------|-----------------|-----------|
   ```

3. **Clique em "Escolher Arquivo"** e selecione seu Excel

4. **Clique em "Importar"**

5. O sistema irá:
   - ✅ Ler todas as 52 mil linhas
   - ✅ Identificar automaticamente as matérias pelos nomes das aulas
   - ✅ Agrupar as aulas por matéria
   - ✅ Formatar em texto otimizado para a IA
   - ✅ Salvar no Firestore

6. **Você verá um resumo:**
   - Total de aulas importadas
   - Quantidade de matérias identificadas
   - Distribuição de aulas por matéria
   - ID do catálogo (use para análise)

---

## 🎯 Como o Sistema Identifica Matérias:

O sistema usa **palavras-chave** no nome da aula para identificar a matéria:

**Exemplos:**
- "Direito do advogado" → **Direito Profissional**
- "Organização dos Poderes" → **Direito Constitucional**
- "Jornada de trabalho" → **Direito do Trabalho**
- "Ações constitucionais" → **Direito Constitucional**

**Matérias detectadas automaticamente:**
- Direito Constitucional
- Direito do Trabalho
- Direito Profissional
- Direito Administrativo
- Direito Penal
- Direito Processual Penal
- Direito Civil
- Direito Processual Civil
- Direito Tributário
- Direito Empresarial
- Português
- Matemática
- Raciocínio Lógico
- Informática
- Legislação
- Outras Matérias (para aulas não identificadas)

---

## 📋 Estrutura do Arquivo Excel:

### **Colunas obrigatórias:**
- `ID_AULA`: Identificador único da aula
- `NOME_AULA`: Nome/título da aula
- `PROFESSOR`: Nome do professor

### **Colunas opcionais:**
- `DATA_GRAVAÇÃO`: Data de gravação
- `QUANTIDA_BLOCOS`: Quantidade de blocos

### **Variações aceitas nos nomes das colunas:**
```
ID_AULA = ID AULA = id
NOME_AULA = NOME AULA = nome
DATA_GRAVAÇÃO = DATA GRAVACAO = data
QUANTIDA_BLOCOS = QUANTIDADE BLOCOS = blocos
PROFESSOR = professor
```

---

## 💾 Dados Salvos no Firestore:

```javascript
{
  userId: "...",
  fileName: "video_aulas.xlsx",
  totalAulas: 52000,
  materias: ["Direito Constitucional", "Direito do Trabalho", ...],
  conteudoFormatado: "# CATÁLOGO DE VÍDEO AULAS\n\n...",
  aulasAgrupadas: {
    "Direito Constitucional": [
      { id: "11", nome: "Organização dos Poderes", professor: "Daniel Lamounier", ... },
      ...
    ],
    ...
  },
  createdAt: Timestamp
}
```

---

## 🔜 Próximos Passos (Em Desenvolvimento):

### **2. Analisar Edital**
- Upload de PDF do edital
- IA extrai matérias do edital
- Busca automaticamente vídeos relacionados no catálogo
- Gera plano de estudos

### **3. Meus Editais**
- Lista de todos os editais analisados
- Histórico de análises
- Exportar relatórios

---

## 🐛 Troubleshooting:

### **Erro: "Nenhum arquivo enviado"**
- Certifique-se de selecionar um arquivo antes de clicar em Importar

### **Erro: "Erro ao processar arquivo Excel"**
- Verifique se o arquivo está no formato correto (.xlsx, .xls, .csv)
- Confirme se as colunas obrigatórias existem
- Tente com um arquivo menor primeiro para testar

### **Muitas aulas em "Outras Matérias"**
- Isso significa que o sistema não conseguiu identificar a matéria pelo nome
- Você pode editar o arquivo `app/api/editais/import-excel/route.ts`
- Adicione mais palavras-chave no objeto `MATERIAS_KEYWORDS`

---

## 📞 Suporte:

Se tiver dúvidas ou problemas, abra uma issue no repositório ou entre em contato.

---

**Status:** ✅ Upload de Vídeo Aulas - IMPLEMENTADO
**Status:** 🚧 Analisar Edital - EM DESENVOLVIMENTO
**Status:** 🚧 Meus Editais - EM DESENVOLVIMENTO
