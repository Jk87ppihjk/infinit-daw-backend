// server.js - VERSÃO CORRIGIDA PARA ARQUITETURA HOSTINGER (FRONTEND) + RENDER (BACKEND)

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// O módulo 'path' não é mais necessário, pois não vamos servir arquivos HTML

const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default';

// --- Bloco de Configurações (Firebase, Stripe, Gemini) ---
// Este bloco permanece idêntico
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) { console.error("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada."); process.exit(1); }
try { const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')); admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); console.log('[Firebase] Firebase Admin SDK inicializado com sucesso.'); } catch (error) { console.error('ERRO: Falha ao inicializar o Firebase Admin SDK.', error); process.exit(1); }
const db = admin.firestore();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) { console.error("ERRO: Variável de ambiente STRIPE_WEBHOOK_SECRET não configurada."); process.exit(1); }
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (!GEMINI_API_KEY) { console.warn("ALERTA: Variável de ambiente GEMINI_API_KEY não configurada."); } else { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log('[Gemini] Cliente da API Gemini inicializado com sucesso.'); } catch (error) { console.error('ERRO: Falha ao inicializar o cliente Gemini.', error); } }
// --- Fim do Bloco de Configurações ---

const app = express();
const port = process.env.PORT || 3000;

// --- Configuração do CORS (Controle de Acesso) ---
// CORRIGIDO: Configuração explícita para permitir requisições APENAS do seu domínio na Hostinger.
const corsOptions = {
  origin: 'https://kocodillo.com',
  optionsSuccessStatus: 200 // para navegadores mais antigos
};
app.use(cors(corsOptions));

// --- Middlewares e Rotas da API ---
// Rota do Webhook do Stripe (requer corpo bruto)
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    // ... (Seu código do webhook permanece aqui, sem alterações) ...
    const sig = req.headers['stripe-signature']; let event; try { event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret); } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
    // (Lógica dos eventos do webhook...)
    res.json({ received: true });
});

// Middleware para parse de JSON para todas as outras rotas
app.use(bodyParser.json());

// Rota para Verificar Assinatura
app.post('/verificar-assinatura', async (req, res) => {
    // ... (Seu código para verificar assinatura permanece aqui, sem alterações) ...
     const { userEmail } = req.body; if (!userEmail) { return res.status(400).json({ message: "Email do usuário não fornecido.", accessLevel: "free" }); } try { const docId = userEmail.replace(/\./g, '_'); const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get(); if (userDoc.exists) { const userData = userDoc.data(); if (userData.accessLevel === 'producer') { return res.json({ email: userEmail, status: 'ativo', accessLevel: userData.accessLevel }); } } res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' }); } catch (error) { res.status(500).json({ message: "Erro interno do servidor ao verificar assinatura.", accessLevel: "free" }); }
});

// Rota para o Equalizador com IA
app.post('/api/ai-eq', async (req, res) => {
    // ... (Nosso código da IA permanece aqui, sem alterações) ...
    if (!genAI) { return res.status(500).json({ message: "A funcionalidade de IA não está configurada no servidor." }); } const { prompt } = req.body; if (!prompt) { return res.status(400).json({ message: "O prompt não pode ser vazio." }); } try { const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); const masterPrompt = `Você é um assistente de engenharia de áudio... (resto do prompt)...: "${prompt}"`; const result = await model.generateContent(masterPrompt); const response = await result.response; const text = response.text(); const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim(); const eqSettings = JSON.parse(cleanedText); res.json(eqSettings); } catch (error) { res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." }); }
});

// As funções de acesso ao Firestore permanecem aqui, sem alterações
async function grantProducerAccess(email) { /* ... */ }
async function revokeProducerAccess(email) { /* ... */ }

// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor de API da Infinit DAW rodando na porta ${port}`);
    console.log(`  Permitindo requisições de: https://kocodillo.com`);
    console.log(`================================================`);
});
