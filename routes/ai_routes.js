// src/routes/ai_routes.js

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

// Carregue sua chave de API do Gemini a partir de variáveis de ambiente
// É ALTAMENTE RECOMENDADO USAR VARIÁVEIS DE AMBIENTE para chaves de API
// Ex: no Render.com, você pode adicionar GEMINI_API_KEY nas variáveis de ambiente.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Erro: A variável de ambiente GEMINI_API_KEY não está definida.");
  // Considere uma forma mais robusta de lidar com isso em produção
  // Por exemplo, encerrar o processo ou lançar um erro fatal
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Função para processar a requisição do usuário e gerar ajustes de EQ
async function processEqRequest(userPrompt) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `Como um engenheiro de áudio, analise o seguinte pedido para ajustes em um equalizador gráfico de 10 bandas (31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz). Forneça os ajustes como um array de 10 números, onde cada número representa o ganho (em dB) para cada banda. Use valores entre -15 e 15. A soma dos ganhos não deve exceder 5 dB. Se o pedido for ambíguo ou impossível de atender dentro dessas restrições, forneça uma resposta razoável.
        
        Exemplos de Saída:
        Pedido: "Aumente um pouco os graves e agudos"
        Resposta: [3, 2, 0, 0, 0, 0, 0, 2, 3, 3]

        Pedido: "Retire os graves"
        Resposta: [-5, -3, -2, 0, 0, 0, 0, 0, 0, 0]

        Pedido: "Deixe a voz mais clara"
        Resposta: [0, 0, 0, 1, 2, 3, 2, 1, 0, 0]

        Pedido: "Preciso de mais punch no bumbo"
        Resposta: [4, 2, 0, 0, 0, 0, 0, 0, 0, 0]

        Pedido: "${userPrompt}"
        Resposta: `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Tenta extrair o array da string gerada pela IA
        try {
            // A IA pode retornar a resposta dentro de uma string, então tentamos parsear
            // Por exemplo: "Resposta: [-5, -3, -2, 0, 0, 0, 0, 0, 0, 0]"
            const jsonStringMatch = text.match(/\[.*\]/);
            if (jsonStringMatch) {
                return JSON.parse(jsonStringMatch[0]);
            }
            // Se não encontrar um array, tenta como um JSON direto se a IA for concisa
            return JSON.parse(text);
        } catch (parseError) {
            console.error("Erro ao parsear a resposta da IA:", parseError);
            // Se o parse falhar, a IA pode ter retornado texto explicativo.
            // Poderíamos tentar extrair números de alguma forma, ou retornar um erro padrão.
            // Por enquanto, vamos retornar um array neutro em caso de falha de parsing.
            return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }

    } catch (error) {
        console.error("Erro ao comunicar com a API do Gemini:", error);
        // Em caso de erro na comunicação com a API, retorne um array neutro ou um erro específico
        return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
}

// Rota para processar o ajuste de EQ usando IA
router.post('/process-eq-ai', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'O prompt do usuário é necessário.' });
    }

    const eqAdjustments = await processEqRequest(prompt);

    // Você pode adicionar mais lógica aqui para validar os ajustes ou formatá-los
    res.json({ adjustments: eqAdjustments });
});

module.exports = router;
