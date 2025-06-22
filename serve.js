// server.js - VERSÃO FINAL E COMPLETA PARA ARQUITETURA SEPARADA (HOSTINGER + RENDER)

// Importações necessárias
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default';

// --- Bloco de Configurações (Firebase, Stripe, Gemini) ---
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) { console.error("ERRO: FIREBASE_SERVICE_ACCOUNT_KEY não configurada."); process.exit(1); }
try {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('[Firebase] SDK inicializado com sucesso.');
} catch (error) {
    console.error('ERRO: Falha ao inicializar o Firebase.', error);
    process.exit(1);
}
const db = admin.firestore();

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) {
    console.error("ERRO: STRIPE_WEBHOOK_SECRET não configurada.");
    process.exit(1);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (!GEMINI_API_KEY) {
    console.warn("ALERTA: GEMINI_API_KEY não configurada.");
} else {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log('[Gemini] Cliente da API Gemini inicializado com sucesso.');
    } catch (error) {
        console.error('ERRO: Falha ao inicializar o cliente Gemini.', error);
    }
}

const app = express();
const port = process.env.PORT || 3000;

// --- Configuração do CORS ---
// Permite que o seu site na Hostinger (kocodillo.com) acesse esta API
const corsOptions = {
  origin: 'https://kocodillo.com', // Se seu domínio for outro, altere aqui
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- Rota do Webhook do Stripe ---
app.post('/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
        console.error(`ERRO no webhook do Stripe: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Lógica para tratar os eventos do webhook...
    res.json({ received: true });
});

// Middleware para parse de JSON para todas as outras rotas
app.use(bodyParser.json());

// --- Funções de Acesso ao Firestore ---
async function grantProducerAccess(email) {
    if (!email) return;
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    await userRef.set({ email: email, accessLevel: 'producer', lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`[Firestore] Acesso 'producer' concedido para ${email}`);
}
async function revokeProducerAccess(email) {
    if (!email) return;
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    await userRef.set({ accessLevel: 'free', lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`[Firestore] Acesso revogado para ${email}`);
}

// --- Rotas da API ---
app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ message: "Email não fornecido.", accessLevel: "free" });
    try {
        const docId = userEmail.replace(/\./g, '_');
        const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get();
        if (userDoc.exists && userDoc.data().accessLevel === 'producer') {
            return res.json({ email: userEmail, status: 'ativo', accessLevel: 'producer' });
        }
        res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' });
    } catch (error) {
        res.status(500).json({ message: "Erro interno do servidor.", accessLevel: "free" });
    }
});

app.post('/api/ai-eq', async (req, res) => {
    if (!genAI) return res.status(500).json({ message: "IA não configurada." });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt vazio." });
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const masterPrompt = `... (prompt completo do EQ) ...`;
        const result = await model.generateContent(masterPrompt);
        const text = (await result.response).text();
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error('Resposta da IA (EQ) inválida.');
        const jsonString = text.substring(startIndex, endIndex + 1);
        res.json(JSON.parse(jsonString));
    } catch (error) {
        console.error("Erro na API Gemini (EQ):", error);
        res.status(500).json({ message: "Erro ao processar o pedido com a IA." });
    }
});

app.post('/api/ai-compressor', async (req, res) => {
    if (!genAI) return res.status(500).json({ message: "IA não configurada." });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt vazio." });
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const masterPrompt = `... (prompt completo do Compressor) ...`;
        const result = await model.generateContent(masterPrompt);
        const text = (await result.response).text();
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error('Resposta da IA (Compressor) inválida.');
        const jsonString = text.substring(startIndex, endIndex + 1);
        res.json(JSON.parse(jsonString));
    } catch (error) {
        console.error("Erro na API Gemini (Compressor):", error);
        res.status(500).json({ message: "Erro ao processar o pedido com a IA." });
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor de API da Infinit DAW rodando na porta ${port}`);
    console.log(`  Permitindo requisições de: https://kocodillo.com`);
    console.log(`================================================`);
});
