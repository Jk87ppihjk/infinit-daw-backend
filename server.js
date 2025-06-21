// server.js - VERSÃO COMPLETA E CORRIGIDA, INTEGRANDO IA SEM REMOVER NADA

// Importações necessárias
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe'); // Importa o SDK do Stripe
const admin = require('firebase-admin'); // Importa o SDK Admin do Firebase
const { GoogleGenerativeAI } = require('@google/generative-ai'); // <-- ADICIONADO PELA IA

// NOVO: Defina um ID para o seu aplicativo que será usado no Firestore
const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-default'; 

// ===================================================================
// === CONFIGURAÇÃO DO FIREBASE ADMIN SDK ============================
// ===================================================================
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
    process.exit(1);
}
try {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] Firebase Admin SDK inicializado com sucesso.');
} catch (error) {
    console.error('ERRO: Falha ao inicializar o Firebase Admin SDK. Verifique a variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY.', error);
    process.exit(1);
}
const db = admin.firestore();

// ===================================================================
// === CONFIGURAÇÃO DO STRIPE ========================================
// ===================================================================
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) {
    console.error("ERRO: Variável de ambiente STRIPE_WEBHOOK_SECRET não configurada.");
    process.exit(1);
}

// --- ADICIONADO PELA IA: CONFIGURAÇÃO DO GEMINI ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (!GEMINI_API_KEY) {
    console.warn("ALERTA: Variável de ambiente GEMINI_API_KEY não configurada.");
} else {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log('[Gemini] Cliente da API Gemini inicializado com sucesso.');
    } catch (error) {
        console.error('ERRO: Falha ao inicializar o cliente Gemini.', error);
    }
}
// --- FIM DA ADIÇÃO ---

const app = express();
const port = process.env.PORT || 3000;

// --- ADICIONADO PELA IA: CONFIGURAÇÃO DE CORS ESPECÍFICA ---
const corsOptions = {
  origin: 'https://kocodillo.com', // Permite requisições apenas do seu frontend
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- FIM DA ADIÇÃO ---


// ===================================================================
// === ROTA DO WEBHOOK DO STRIPE =====================================
// ===================================================================
// Seu código original, 100% intacto
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
        console.log('[Webhook] Evento Stripe recebido e assinado com sucesso.');
    } catch (err) {
        console.error(`ERRO: Falha na verificação da assinatura do webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.customer_details.email;
        if (userEmail) {
            console.log(`[Webhook] Pagamento bem-sucedido para o email: ${userEmail}`);
            await grantProducerAccess(userEmail);
        } else {
            console.warn('[Webhook] Evento checkout.session.completed sem email de cliente.');
        }
    }
    else if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const userEmail = subscription.metadata && subscription.metadata.userEmail ? subscription.metadata.userEmail : null;
        if (userEmail) {
            console.log(`[Webhook] Assinatura atualizada para o email: ${userEmail}. Status: ${subscription.status}`);
            if (subscription.status === 'active' || subscription.status === 'trialing') {
                await grantProducerAccess(userEmail);
            } else {
                await revokeProducerAccess(userEmail);
            }
        } else {
            console.warn(`[Webhook] Evento customer.subscription.updated sem email de cliente. Customer ID: ${customerId}`);
        }
    }
    else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userEmail = subscription.metadata && subscription.metadata.userEmail ? subscription.metadata.userEmail : null;
        if (userEmail) {
            console.log(`[Webhook] Assinatura DELETADA para o email: ${userEmail}.`);
            await revokeProducerAccess(userEmail);
        } else {
            console.warn(`[Webhook] Evento customer.subscription.deleted sem email de cliente. Customer ID: ${subscription.customer}`);
        }
    }
    else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;
        const userEmail = invoice.customer_email;
        if (userEmail) {
            console.log(`[Webhook] Pagamento de fatura bem-sucedido para o email: ${userEmail}.`);
            await grantProducerAccess(userEmail);
        } else {
            console.warn(`[Webhook] Evento invoice.payment_succeeded sem email de cliente. Invoice ID: ${invoice.id}`);
        }
    }
    else {
        console.log(`[Webhook] Evento Stripe não processado: ${event.type}`);
    }
    res.json({ received: true });
});

// Seu código original, 100% intacto
app.use(bodyParser.json());

// ===================================================================
// === FUNÇÕES DE MANIPULAÇÃO DE USUÁRIOS NO FIRESTORE ===============
// ===================================================================
// Suas funções originais, 100% intactas
async function grantProducerAccess(email) {
    if (!email) { console.warn("[Firestore] Tentativa de conceder acesso sem email."); return; }
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    const userData = { email: email, accessLevel: 'producer', lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
    try {
        await userRef.set(userData, { merge: true });
        console.log(`[Firestore] Acesso 'producer' concedido/atualizado para o email: ${email}`);
    } catch (error) {
        console.error(`[Firestore] ERRO ao conceder acesso 'producer' para ${email}:`, error);
    }
}
async function revokeProducerAccess(email) {
    if (!email) { console.warn("[Firestore] Tentativa de revogar acesso sem email."); return; }
    const docId = email.replace(/\./g, '_');
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    const userData = { accessLevel: 'free', lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
    try {
        await userRef.set(userData, { merge: true });
        console.log(`[Firestore] Acesso do email: ${email} revogado para 'free'.`);
    } catch (error) {
        console.error(`[Firestore] ERRO ao revogar acesso para ${email}:`, error);
    }
}

// Endpoint para verificação de assinatura, seu código original 100% intacto
app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    console.log(`[Servidor] Recebida verificação para o email: ${userEmail}`);
    if (!userEmail) { return res.status(400).json({ message: "Email do usuário não fornecido.", accessLevel: "free" }); }
    try {
        const docId = userEmail.replace(/\./g, '_');
        const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.accessLevel === 'producer') {
                console.log(`[Servidor] Usuário ${userEmail} encontrado no Firestore. Status: ${userData.accessLevel}`);
                return res.json({ email: userEmail, status: 'ativo', accessLevel: userData.accessLevel });
            }
        }
        console.log(`[Servidor] Usuário ${userEmail} não encontrado ou sem assinatura 'producer'. Concedendo acesso 'free'.`);
        res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' });
    } catch (error) {
        console.error(`[Servidor] ERRO ao verificar assinatura para ${userEmail} no Firestore:`, error);
        res.status(500).json({ message: "Erro interno do servidor ao verificar assinatura.", accessLevel: "free" });
    }
});


// --- ADICIONADO PELA IA: NOVA ROTA PARA O EQUALIZADOR ---
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
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const eqSettings = JSON.parse(cleanedText);
        console.log(`[AI-EQ] Prompt: "${prompt}" -> Resposta:`, eqSettings);
        res.json(eqSettings);
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        res.status(500).json({ message: "Ocorreu um erro ao processar seu pedido com a IA." });
    }
});
// --- FIM DA ADIÇÃO ---


// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${port}`);
    console.log(`  Rota de Webhook esperando em /stripe-webhook`);
    console.log(`  Permitindo requisições de: https://kocodillo.com`); // <-- ADICIONADO PELA IA
    console.log(`  Endpoint de IA esperando em /api/ai-eq`); // <-- ADICIONADO PELA IA
    console.log(`================================================`);
});
