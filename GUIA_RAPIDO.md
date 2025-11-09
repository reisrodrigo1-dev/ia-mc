# 🎯 Guia Rápido de Uso

## 📱 Como Usar o Sistema

### 1️⃣ **Primeiro Acesso**

1. Acesse: http://localhost:3000
2. Clique em "Criar conta"
3. Preencha:
   - Nome completo
   - Email: `seunome@meucurso.com.br` ⚠️ **IMPORTANTE: Precisa ser @meucurso.com.br**
   - Senha (mínimo 6 caracteres)
4. Confirme a senha

### 2️⃣ **Login**

1. Acesse: http://localhost:3000/login
2. Digite email e senha
3. Clique em "Entrar"

### 3️⃣ **Criar uma Nova Conversa**

1. No dashboard, clique em "Nova Conversa" (botão azul com +)
2. Digite sua pergunta na caixa de texto
3. Pressione Enter ou clique no ícone de enviar
4. A IA responderá em tempo real! ✨

### 4️⃣ **Super Admin (rodrigo.reis@meucurso.com.br)**

Se você criar uma conta com o email `rodrigo.reis@meucurso.com.br`, terá acesso a:

- 🔐 Gestão de Setores
- 👥 Criar e gerenciar setores
- ⚙️ Permissões especiais
- 👁️ Visualizar todos os recursos

## 🎨 Recursos do Chat

### **Durante a Conversa**
- ✅ Respostas em streaming (letra por letra)
- ✅ Histórico salvo automaticamente
- ✅ Interface limpa e moderna
- ✅ Suporte a textos longos

### **Atalhos de Teclado**
- `Enter`: Enviar mensagem
- `Shift + Enter`: Nova linha

## 🏢 Setores (Em Breve)

### Conceito:
- **Chat Privado**: Só você vê
- **Chat de Setor**: Todos do setor veem

### Quem pode criar setores?
Apenas o **Super Admin** (`rodrigo.reis@meucurso.com.br`)

## 🤖 Agentes (Em Desenvolvimento)

Agentes são assistentes especializados. Exemplo:
- 📚 **Professor**: Explica conceitos educacionais
- 💻 **Programador**: Ajuda com código
- 📝 **Redator**: Escreve textos profissionais

## 📋 Prompts (Em Desenvolvimento)

Biblioteca de prompts prontos para reutilizar:
- Templates de perguntas
- Instruções personalizadas
- Contextos específicos

## 🆘 Problemas Comuns

### ❌ "Apenas emails @meucurso.com.br são permitidos"
**Solução**: Use um email corporativo válido

### ❌ "Este email já está em uso"
**Solução**: Faça login ou use outro email

### ❌ "Erro ao fazer login"
**Solução**: Verifique email e senha

### ❌ Chat não responde
**Solução**: 
1. Verifique se o servidor está rodando (`npm run dev`)
2. Confira se a API Key do OpenAI está configurada no `.env.local`

## 🔧 Configuração do Firebase

### **Passo 1: Criar Firestore Database**
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto `ia-mc-26164`
3. Vá em **Firestore Database**
4. Clique em **Criar banco de dados**
5. Escolha **Modo de produção**
6. Selecione localização (southamerica-east1)

### **Passo 2: Aplicar Regras de Segurança**
1. Em Firestore, vá na aba **Regras**
2. Cole o conteúdo do arquivo `firestore.rules`
3. Clique em **Publicar**

### **Passo 3: Habilitar Authentication**
1. Vá em **Authentication**
2. Clique em **Começar**
3. Habilite **Email/Password**

## 🚀 Dicas Pro

### **Melhor aproveitamento do Chat**
1. Seja específico nas perguntas
2. Forneça contexto quando necessário
3. Use formatação (quebras de linha)

### **Organização**
1. Crie chats separados por tema
2. Use títulos descritivos
3. Compartilhe chats relevantes com o setor

## 📊 Status Atual

✅ **Funcionando**
- Autenticação
- Chat com IA
- Interface moderna
- Salvamento automático

🚧 **Em Desenvolvimento**
- Lista de conversas anteriores
- Agentes personalizados
- Biblioteca de prompts
- Gestão completa de setores

## 🎉 Pronto!

Agora é só usar! 

**URL**: http://localhost:3000

Divirta-se conversando com a IA! 🤖💬
