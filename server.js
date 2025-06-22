// server.js - VERSÃO FINAL MODULARIZADA E COMPLETA

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const aiRoutes = require('./routes/ai_routes'); // Importa nosso novo arquivo de rotas

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

// Configuração de CORS para permitir acesso do seu frontend
const corsOptions = {
  origin: 'https://kocodillo.com', // Este domínio é um placeholder, ajuste se for diferente
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- Rota do Webhook do Stripe ---
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature']; let event;
    try { event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret); } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.customer_details.email;
        if (userEmail) { await grantProducerAccess(userEmail); }
    }
    // (outros eventos do stripe aqui, se houver...)
    res.json({ received: true });
});

app.use(bodyParser.json());

// --- Funções e Rotas da Aplicação ---
async function grantProducerAccess(email) {
    if (!email) { return; }
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    const userData = { email: email, accessLevel: 'producer', lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
    try { await userRef.set(userData, { merge: true }); console.log(`[Firestore] Acesso 'producer' concedido para ${email}`); } catch (error) { console.error(`[Firestore] ERRO ao conceder acesso para ${email}:`, error); }
}
async function revokeProducerAccess(email) {
    if (!email) { return; }
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    const userData = { accessLevel: 'free', lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
    try { await userRef.set(userData, { merge: true }); console.log(`[Firestore] Acesso revogado para ${email}`); } catch (error) { console.error(`[Firestore] ERRO ao revogar acesso para ${email}:`, error); }
}

app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    if (!userEmail) { return res.status(400).json({ message: "Email não fornecido.", accessLevel: "free" }); }
    try {
        const docId = userEmail.replace(/\./g, '_');
        const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get();
        if (userDoc.exists && userDoc.data().accessLevel === 'producer') {
            return res.json({ email: userEmail, status: 'ativo', accessLevel: 'producer' });
        }
        res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' });
    } catch (error) {
        console.error(`ERRO ao verificar assinatura para ${userEmail}:`, error);
        res.status(500).json({ message: "Erro interno do servidor.", accessLevel: "free" });
    }
});

// --- Usando o novo arquivo de rotas para a IA ---
// Qualquer requisição para /api/... será gerenciada pelo nosso novo arquivo.
app.use('/api', aiRoutes(genAI));

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
    console.log(`  Rotas da IA carregadas de /routes/ai_routes.js`);
    console.log(`================================================`);
});
