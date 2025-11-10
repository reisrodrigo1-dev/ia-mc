# Adicionar Campo de Timeout de Inatividade na UI

## Localização
Arquivo: `app/dashboard/whatsapp/training/page.tsx`

## O que fazer
Adicionar campo de `inactivityTimeout` nos formulários de criação e edição de treinamento.

---

## 1. Adicionar state variable (já deve ter outros states como exitKeywords)

```tsx
const [inactivityTimeout, setInactivityTimeout] = useState<number>(0);
```

---

## 2. Adicionar campo visual no formulário

**Adicionar APÓS os campos de Exit Keywords** (ou onde estiver adicionando os campos de exit keywords):

```tsx
{/* Timeout de Inatividade */}
{mode === 'keywords' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Timeout de Inatividade (opcional)
    </label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="1"
        value={inactivityTimeout || ''}
        onChange={(e) => setInactivityTimeout(Number(e.target.value) || 0)}
        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        placeholder="0"
      />
      <span className="text-sm text-gray-600">minutos</span>
    </div>
    <p className="text-xs text-gray-500 mt-1">
      Tempo sem mensagens para desativar automaticamente. Use 0 para nunca expirar. 
      <strong>Exemplo:</strong> 60 = 1 hora, 1440 = 1 dia
    </p>
  </div>
)}
```

---

## 3. Incluir no handleCreate (salvar)

Na função que salva o treinamento, adicionar:

```tsx
const trainingData = {
  // ...outros campos
  exitKeywords: exitKeywords,
  exitMessage: exitMessage,
  inactivityTimeout: inactivityTimeout, // ← ADICIONAR ESTA LINHA
  // ...outros campos
};
```

---

## 4. Incluir no handleUpdate (atualizar)

Na função que atualiza o treinamento, adicionar:

```tsx
await updateDoc(trainingRef, {
  // ...outros campos
  exitKeywords: exitKeywords,
  exitMessage: exitMessage,
  inactivityTimeout: inactivityTimeout, // ← ADICIONAR ESTA LINHA
  // ...outros campos
});
```

---

## 5. Carregar valor ao editar

Na função que carrega dados para edição (onde você carrega exitKeywords):

```tsx
setExitKeywords(training.exitKeywords || []);
setExitMessage(training.exitMessage || '');
setInactivityTimeout(training.inactivityTimeout || 0); // ← ADICIONAR ESTA LINHA
```

---

## 6. Resetar no resetForm()

```tsx
const resetForm = () => {
  // ...outros resets
  setExitKeywords([]);
  setExitMessage('');
  setInactivityTimeout(0); // ← ADICIONAR ESTA LINHA
};
```

---

## Como funciona

1. **Usuário cria treinamento** com timeout de 60 minutos
2. **Cliente envia mensagem** com keyword → treinamento ativa
3. **Sistema atualiza** `lastMessageAt` a cada mensagem recebida
4. **Monitor verifica a cada 5 minutos** se algum chat está inativo
5. **Se passou 60 minutos** sem mensagem → desativa automaticamente o treinamento
6. **Próxima mensagem** com keyword → reativa novamente

## Valores sugeridos

- **0 ou vazio**: Nunca expira (padrão)
- **30**: 30 minutos
- **60**: 1 hora (recomendado)
- **120**: 2 horas
- **1440**: 1 dia (24 horas)
