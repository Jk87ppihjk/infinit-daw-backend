// ai-server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { LanguageServiceClient } = require('@google-cloud/language'); // Exemplo para Natural Language API
// Você adicionará outras bibliotecas de IA do Google aqui conforme precisarmos,
// como @google-cloud/speech para transcrição de áudio, por exemplo.

const app = express();
const port = process.env.PORT || 4000; // Use uma porta diferente do seu backend existente, se ele estiver na mesma máquina

// --- Configuração do CORS ---
// É CRUCIAL definir isso corretamente para que seu frontend (na Hostinger)
// possa se comunicar com este novo backend (no Render.com).
// SUBSTITUA 'https://SEU_DOMINIO_DA_DAW_AQUI.com' pelo URL REAL do seu frontend (ex: https://infinit-daw.com.br)
app.use(cors({
  origin: 'https://kocodillo.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Permita os métodos HTTP que você usará
  allowedHeaders: ['Content-Type', 'Authorization'] // Permita os cabeçalhos que você usará
}));

app.use(bodyParser.json());

// --- Inicialização do Cliente Google Cloud AI ---
// Esta parte é para se conectar à API de IA do Google.
// Ela espera uma variável de ambiente no Render.com chamada GOOGLE_APPLICATION_CREDENTIALS_JSON
// que conterá sua chave de conta de serviço do Google Cloud codificada em Base64.
let languageClient;
try {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error('Variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não definida.');
  }
  const serviceAccountKeyJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf8');
  const serviceAccountKey = JSON.parse(serviceAccountKeyJson);

  languageClient = new LanguageServiceClient({
    credentials: serviceAccountKey
  });
  console.log('Cliente da Google Natural Language API inicializado.');
} catch (error) {
  console.error('Falha ao inicializar o Cliente da Google Natural Language API:', error);
  // Se não conseguir inicializar o cliente de IA, o servidor não deve rodar
  process.exit(1);
}

// --- Endpoint de exemplo: Análise de Sentimento ---
// Este é um exemplo de como você pode criar um endpoint para uma funcionalidade de IA.
// Ele recebe um texto e usa a Natural Language API para analisar o sentimento.
app.post('/api/analyze-sentiment', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'O texto é obrigatório para análise de sentimento.' });
  }

  try {
    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };

    const [result] = await languageClient.analyzeSentiment({ document: document });
    const sentiment = result.documentSentiment;

    res.json({
      score: sentiment.score,
      magnitude: sentiment.magnitude,
      message: `Sentimento do texto: Pontuação: ${sentiment.score}, Magnitude: ${sentiment.magnitude}`
    });
  } catch (error) {
    console.error('Erro ao analisar sentimento:', error);
    res.status(500).json({ error: 'Falha ao analisar sentimento. Por favor, tente novamente.' });
  }
});

// --- Endpoint de "saúde" (Health Check) ---
// Útil para verificar se o servidor está online.
app.get('/', (req, res) => {
  res.send('Infinit DAW AI Backend is running!');
});

// --- Iniciar o Servidor ---
app.listen(port, () => {
  console.log(`AI Backend listening on port ${port}`);
});
