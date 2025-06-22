// server.js - VERSÃO MODULARIZADA

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const aiRoutes = require('./routes/ai_routes'); // <-- ADICIONADO: Importa nosso novo arquivo de rotas

const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default';

// --- Bloco de Configurações (Firebase, Stripe, Gemini) ---
// (Este bloco permanece idêntico)
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

const corsOptions = { origin: 'https://kocodillo.com', optionsSuccessStatus: 200 };
app.use(cors(corsOptions));

// --- Rota do Webhook do Stripe ---
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    // (Seu código completo do webhook fica aqui, sem alterações)
    // ...
    res.json({ received: true });
});

app.use(bodyParser.json());

// --- Funções e Rota de Verificação de Assinatura ---
// (Suas funções grant/revoke e a rota /verificar-assinatura ficam aqui, sem alterações)
async function grantProducerAccess(email) { /* ... */ }
async function revokeProducerAccess(email) { /* ... */ }
app.post('/verificar-assinatura', async (req, res) => {
    // (Seu código completo de verificar assinatura fica aqui)
    // ...
});

// --- ADICIONADO: Usando o novo arquivo de rotas para a IA ---
// Qualquer requisição para /api/... será gerenciada pelo nosso novo arquivo.
app.use('/api', aiRoutes(genAI));
// --- FIM DA ADIÇÃO ---


// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${port}`);
    console.log(`  Permitindo requisições de: https://kocodillo.com`);
    console.log(`  Rotas da IA carregadas de /routes/ai_routes.js`); // Log atualizado
    console.log(`================================================`);
});
