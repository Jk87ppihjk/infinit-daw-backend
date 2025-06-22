// routes/ai_routes.js - Arquivo completo com a lógica da IA

const express = require('express');
const router = express.Router();

// Esta função recebe a instância do cliente Gemini (genAI) do arquivo principal server.js
function createAiRoutes(genAI) {
    
    // ROTA PARA O EQUALIZADOR COM IA
    router.post('/ai-eq', async (req, res) => {
        if (!genAI) {
            return res.status(500).json({ message: "A funcionalidade de IA não está configurada no servidor." });
        }
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ message: "O prompt não pode ser vazio." });
        }
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const masterPrompt = `Você é um assistente de engenharia de áudio especializado em mixagem. Sua tarefa é converter um pedido de um usuário em linguagem natural para configurações de um equalizador gráfico de 10 bandas. As bandas disponíveis e seus IDs de parâmetro são: 32 Hz (gain_32hz), 64 Hz (gain_64hz), 125 Hz (gain_125hz), 250 Hz (gain_250hz), 500 Hz (gain_500hz), 1 kHz (gain_1k), 2 kHz (gain_2k), 4 kHz (gain_4k), 8 kHz (gain_8k), 16 kHz (gain_16k). O ganho (gain) para cada banda deve ser um número entre -18.0 e 18.0. IMPORTANTE: Sua resposta DEVE SER APENAS um objeto JSON válido, sem nenhum texto, explicação ou markdown adicional (como \`\`\`json). O JSON deve conter exatamente as 10 chaves correspondentes aos IDs das bandas. Agora, processe o seguinte pedido do usuário: "${prompt}"`;
            
            const result = await model.generateContent(masterPrompt);
            const response = await result.response;
            const text = response.text();
            
            const startIndex = text.indexOf('{');
            const endIndex = text.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) {
                console.error("Resposta da IA (EQ) não continha um JSON válido:", text);
                throw new Error('A resposta da IA (EQ) não continha um objeto JSON válido.');
            }
            
            const jsonString = text.substring(startIndex, endIndex + 1);
            const eqSettings = JSON.parse(jsonString);
            
            console.log(`[AI-EQ] Prompt: "${prompt}" -> Resposta:`, eqSettings);
            res.json(eqSettings);
        } catch (error) {
            console.error("Erro na API Gemini (EQ):", error);
            res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
        }
    });

    // ROTA PARA O COMPRESSOR COM IA
    router.post('/ai-compressor', async (req, res) => {
        if (!genAI) {
            return res.status(500).json({ message: "A funcionalidade de IA não está configurada no servidor." });
        }
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ message: "O prompt não pode ser vazio." });
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const masterPrompt = `Você é um engenheiro de áudio especialista em processamento de dinâmica. Sua tarefa é converter um pedido de um usuário em linguagem natural para configurações de um compressor de áudio. Os parâmetros disponíveis e suas faixas de valores são: - threshold: (Número de -100 a 0) em dB. O ponto onde a compressão começa. - knee: (Número de 0 a 40). A suavidade da transição para a compressão. - ratio: (Número de 1 a 20). A proporção da compressão (ex: 4 significa 4:1). - attack: (Número de 0.0 a 1.0) em segundos. O tempo para o compressor começar a atuar. - release: (Número de 0.0 a 1.0) em segundos. O tempo para o compressor parar de atuar. Analise o pedido do usuário e gere a configuração correspondente. Pedidos como "punchy", "agressivo" ou "pesado" devem ter attack rápido e ratio alto. Pedidos como "suave", "transparente", "cola" ou "glue" devem ter attack mais lento, ratio baixo e knee mais alto. IMPORTANTE: Sua resposta DEVE SER APENAS um objeto JSON válido, sem nenhum texto, explicação ou markdown adicional. O JSON deve conter as chaves: "threshold", "knee", "ratio", "attack", "release". Agora, processe o seguinte pedido do usuário: "${prompt}"`;
            
            const result = await model.generateContent(masterPrompt);
            const response = await result.response;
            const text = response.text();
            
            const startIndex = text.indexOf('{');
            const endIndex = text.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) {
                console.error("Resposta da IA (Compressor) não continha um JSON válido:", text);
                throw new Error('A resposta da IA (Compressor) não continha um objeto JSON válido.');
            }

            const jsonString = text.substring(startIndex, endIndex + 1);
            const compSettings = JSON.parse(jsonString);

            console.log(`[AI-Compressor] Prompt: "${prompt}" -> Resposta:`, compSettings);
            res.json(compSettings);
        } catch (error) {
            console.error("Erro na API Gemini (Compressor):", error);
            res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
        }
    });

    return router;
}

module.exports = createAiRoutes;
