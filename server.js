// server.js - VERSÃO FINAL COM TUDO EM UM ÚNICO ARQUIVO

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path'); // Adicionamos path para servir arquivos estáticos

const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default';

// --- Bloco de Configurações (Firebase, Stripe, Gemini) ---
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) { console.error("ERRO: FIREBASE_SERVICE_ACCOUNT_KEY não configurada."); process.exit(1); }
try { const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')); admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); console.log('[Firebase] SDK inicializado.'); } catch (error) { console.error('ERRO: Falha ao inicializar Firebase.', error); process.exit(1); }
const db = admin.firestore();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) { console.error("ERRO: STRIPE_WEBHOOK_SECRET não configurada."); process.exit(1); }
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (!GEMINI_API_KEY) { console.warn("ALERTA: GEMINI_API_KEY não configurada."); } else { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log('[Gemini] Cliente inicializado.'); } catch (error) { console.error('ERRO: Falha ao inicializar Gemini.', error); } }

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = { origin: '*', optionsSuccessStatus: 200 };
app.use(cors(corsOptions));

// --- Rota do Webhook do Stripe ---
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    // ... (Seu código completo do webhook aqui) ...
    res.json({ received: true });
});

app.use(bodyParser.json());

// --- Funções e Rotas da Aplicação ---
async function grantProducerAccess(email) { /* ...Sua função completa aqui... */ }
async function revokeProducerAccess(email) { /* ...Sua função completa aqui... */ }

app.post('/verificar-assinatura', async (req, res) => {
    // ... Seu código completo de verificar assinatura aqui ...
});

// --- ROTAS DA IA ---
app.post('/api/ai-eq', async (req, res) => {
    if (!genAI) { return res.status(500).json({ message: "A IA não está configurada no servidor." }); }
    const { prompt } = req.body;
    if (!prompt) { return res.status(400).json({ message: "O prompt não pode ser vazio." }); }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const masterPrompt = `Você é um engenheiro de áudio... (prompt completo do EQ)...: "${prompt}"`;
        const result = await model.generateContent(masterPrompt);
        const text = (await result.response).text();
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) { throw new Error('A resposta da IA (EQ) não continha um JSON válido.'); }
        const jsonString = text.substring(startIndex, endIndex + 1);
        const eqSettings = JSON.parse(jsonString);
        console.log(`[AI-EQ] Prompt: "${prompt}" -> Resposta:`, eqSettings);
        res.json(eqSettings);
    } catch (error) {
        console.error("Erro na API Gemini (EQ):", error);
        res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
    }
});

app.post('/api/ai-compressor', async (req, res) => {
    if (!genAI) { return res.status(500).json({ message: "A IA não está configurada no servidor." }); }
    const { prompt } = req.body;
    if (!prompt) { return res.status(400).json({ message: "O prompt não pode ser vazio." }); }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const masterPrompt = `Você é um engenheiro de áudio especialista em processamento de dinâmica... (prompt completo do Compressor)...: "${prompt}"`;
        const result = await model.generateContent(masterPrompt);
        const text = (await result.response).text();
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) { throw new Error('A resposta da IA (Compressor) não continha um JSON válido.'); }
        const jsonString = text.substring(startIndex, endIndex + 1);
        const compSettings = JSON.parse(jsonString);
        console.log(`[AI-Compressor] Prompt: "${prompt}" -> Resposta:`, compSettings);
        res.json(compSettings);
    } catch (error) {
        console.error("Erro na API Gemini (Compressor):", error);
        res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
    }
});

// --- Servir Arquivos Estáticos e Rota Catch-All ---
app.use(express.static(path.join(__dirname, 'public_html')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public_html', 'index.html'));
});

// --- Inicia o servidor ---
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${port}`);
    console.log(`  Servindo arquivos de: ${path.join(__dirname, 'public_html')}`);
    console.log(`  Rotas de API prontas.`);
    console.log(`================================================`);
});
