// server.js - VERSÃO FINAL COM PARSE DE JSON ROBUSTO

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ... (SEU BLOCO DE CONFIGURAÇÃO DO FIREBASE, STRIPE E GEMINI FICA AQUI, IDÊNTICO AO ANTERIOR) ...
const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default';
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) { console.error("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada."); process.exit(1); }
try { const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')); admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); console.log('[Firebase] Firebase Admin SDK inicializado com sucesso.'); } catch (error) { console.error('ERRO: Falha ao inicializar o Firebase Admin SDK. Verifique a variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY.', error); process.exit(1); }
const db = admin.firestore();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) { console.error("ERRO: Variável de ambiente STRIPE_WEBHOOK_SECRET não configurada."); process.exit(1); }
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (!GEMINI_API_KEY) { console.warn("ALERTA: Variável de ambiente GEMINI_API_KEY não configurada."); } else { try { genAI = new GoogleGenerativeAI(GEMINI_API_KEY); console.log('[Gemini] Cliente da API Gemini inicializado com sucesso.'); } catch (error) { console.error('ERRO: Falha ao inicializar o cliente Gemini.', error); } }

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = { origin: 'https://kocodillo.com', optionsSuccessStatus: 200 };
app.use(cors(corsOptions));

// ... (SUAS ROTAS /verificar-assinatura E /stripe-webhook E FUNÇÕES grant/revoke FICAM AQUI, IDÊNTICAS) ...
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => { const sig = req.headers['stripe-signature']; let event; try { event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret); } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); } /* ...lógica dos eventos... */ res.json({ received: true }); });
app.use(bodyParser.json());
app.post('/verificar-assinatura', async (req, res) => { const { userEmail } = req.body; if (!userEmail) { return res.status(400).json({ message: "Email do usuário não fornecido.", accessLevel: "free" }); } try { const docId = userEmail.replace(/\./g, '_'); const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get(); if (userDoc.exists) { const userData = userDoc.data(); if (userData.accessLevel === 'producer') { return res.json({ email: userEmail, status: 'ativo', accessLevel: userData.accessLevel }); } } res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' }); } catch (error) { res.status(500).json({ message: "Erro interno do servidor ao verificar assinatura.", accessLevel: "free" }); } });
async function grantProducerAccess(email) { if (!email) { return; } const docId = email.replace(/\./g, '_'); const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId); const userData = { email: email, accessLevel: 'producer', lastUpdated: admin.firestore.FieldValue.serverTimestamp() }; try { await userRef.set(userData, { merge: true }); } catch (error) { console.error(`[Firestore] ERRO ao conceder acesso 'producer' para ${email}:`, error); } }
async function revokeProducerAccess(email) { if (!email) { return; } const docId = email.replace(/\./g, '_'); const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId); const userData = { accessLevel: 'free', lastUpdated: admin.firestore.FieldValue.serverTimestamp() }; try { await userRef.set(userData, { merge: true }); } catch (error) { console.error(`[Firestore] ERRO ao revogar acesso para ${email}:`, error); } }


// --- ROTA DA IA COM O AJUSTE FINAL ---
app.post('/api/ai-eq', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ message: "A funcionalidade de IA não está configurada no servidor." });
    }
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: "O prompt não pode ser vazio." });
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const masterPrompt = `Você é um assistente de engenharia de áudio... (o prompt completo que já definimos)...: "${prompt}"`;
        
        const result = await model.generateContent(masterPrompt);
        const response = await result.response;
        const text = response.text();

        // --- INÍCIO DA CORREÇÃO ---
        // Procura de forma inteligente pelo início '{' e o fim '}' do JSON na resposta da IA
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
            console.error("Resposta da IA não continha um JSON válido:", text);
            throw new Error('A resposta da IA não continha um objeto JSON válido.');
        }
        
        const jsonString = text.substring(startIndex, endIndex + 1);
        const eqSettings = JSON.parse(jsonString);
        // --- FIM DA CORREÇÃO ---

        console.log(`[AI-EQ] Prompt: "${prompt}" -> Resposta:`, eqSettings);
        res.json(eqSettings);
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
    }
});


// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${port}`);
    console.log(`  Rota de Webhook esperando em /stripe-webhook`);
    console.log(`  Permitindo requisições de: https://kocodillo.com`);
    console.log(`  Endpoint de IA esperando em /api/ai-eq`);
    console.log(`================================================`);
});
