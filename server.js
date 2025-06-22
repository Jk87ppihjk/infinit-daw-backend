// server.js - VERSÃO FINAL E UNIFICADA (IA + LICENÇAS + STRIPE)

// ===================================================================
// === IMPORTAÇÕES DOS MÓDULOS =======================================
// ===================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const createAiRoutes = require('./routes/ai_routes.js'); // Importa as rotas de IA

// ===================================================================
// === CONFIGURAÇÃO DAS VARIÁVEIS DE AMBIENTE =======================
// ===================================================================
// ATENÇÃO: Todas as chaves secretas DEVEM ser configuradas como Variáveis de Ambiente no seu serviço de hospedagem (Render.com).
// Nunca deixe chaves secretas diretamente no código.

const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY; // Em formato Base64
const stripeSecretKey = process.env.STRIPE_SECRET_KEY; // Chave secreta principal do Stripe (sk_...)
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Chave do endpoint do webhook (whsec_...)
const geminiApiKey = process.env.GEMINI_API_KEY; // Chave da API do Google AI Studio

// ID único para a instância da sua aplicação no Firestore, para organizar os dados.
const APP_INSTANCE_ID = process.env.APP_INSTANCE_ID || 'infinit-daw-main';

// ===================================================================
// === INICIALIZAÇÃO DOS SERVIÇOS ====================================
// ===================================================================

// --- 1. Inicialização do Firebase Admin SDK ---
let db;
try {
    if (!firebaseServiceAccountKey) throw new Error("A variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não está configurada.");
    const serviceAccount = JSON.parse(Buffer.from(firebaseServiceAccountKey, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('[Firebase] Firebase Admin SDK inicializado com sucesso.');
} catch (error) {
    console.error('[Firebase] ERRO CRÍTICO ao inicializar o Firebase Admin SDK:', error.message);
    process.exit(1); // Encerra a aplicação se o Firebase não puder ser iniciado.
}

// --- 2. Inicialização do Stripe ---
// A chave secreta é necessária para criar o objeto Stripe, que usaremos para validar os webhooks.
if (!stripeSecretKey) {
    console.error('[Stripe] ERRO CRÍTICO: A variável de ambiente STRIPE_SECRET_KEY não foi definida.');
    process.exit(1);
}
const stripe = require('stripe')(stripeSecretKey);

// --- 3. Inicialização do Google Generative AI (Gemini) ---
let genAI;
try {
    if (!geminiApiKey) throw new Error("A variável de ambiente GEMINI_API_KEY é necessária para a funcionalidade de IA.");
    genAI = new GoogleGenerativeAI(geminiApiKey);
    console.log('[AI] Google Generative AI SDK inicializado com sucesso.');
} catch (error) {
    console.error('[AI] ERRO ao inicializar o Google Generative AI SDK. As rotas de IA não funcionarão.', error.message);
    // Não encerra o processo, a DAW pode funcionar sem IA.
}

// ===================================================================
// === CONFIGURAÇÃO DO SERVIDOR EXPRESS ==============================
// ===================================================================

const app = express();
app.use(cors()); // Habilita o CORS para todas as rotas

// --- ROTA DE WEBHOOK DO STRIPE ---
// Esta rota precisa usar 'express.raw' para receber o corpo da requisição sem modificação, o que é essencial para a verificação do Stripe.
// Ela deve vir ANTES do 'express.json()'.
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (request, response) => {
    if (!stripeWebhookSecret) {
        console.error('[Stripe] ERRO: Webhook secret não configurado no servidor.');
        return response.status(500).send('Webhook secret não configurado no servidor.');
    }

    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, stripeWebhookSecret);
    } catch (err) {
        console.error(`[Stripe] Falha na verificação da assinatura do webhook: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lida com o evento de checkout bem-sucedido
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session.customer_details.email;
        console.log(`[Stripe] Evento 'checkout.session.completed' recebido para: ${customerEmail}`);
        if (customerEmail) {
            await grantProducerAccess(customerEmail);
        } else {
            console.warn('[Stripe] Evento de checkout completo sem email do cliente.');
        }
    } else {
        console.log(`[Stripe] Evento não tratado recebido: ${event.type}`);
    }

    response.json({ received: true });
});

// Middleware para fazer o parse de JSON para TODAS as outras rotas
app.use(express.json());

// ===================================================================
// === ROTAS DA APLICAÇÃO ============================================
// ===================================================================

// --- Rotas de IA ---
// Se a inicialização da IA falhou, as rotas ainda serão criadas, mas retornarão um erro informando que o serviço não está disponível.
const aiRouter = createAiRoutes(genAI);
app.use('/api', aiRouter);

// --- Rota para Verificar Licença ---
app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    if (!userEmail) {
        return res.status(400).json({ message: "Email do usuário não fornecido.", accessLevel: "free" });
    }

    try {
        const docId = userEmail.replace(/\./g, '_');
        const userDoc = await db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId).get();

        if (userDoc.exists && userDoc.data().accessLevel === 'producer') {
            return res.json({ email: userEmail, status: 'ativo', accessLevel: 'producer' });
        }

        res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' });
    } catch (error) {
        console.error(`[Servidor] ERRO ao verificar assinatura para ${userEmail}:`, error);
        res.status(500).json({ message: "Erro interno do servidor.", accessLevel: "free" });
    }
});

// ===================================================================
// === FUNÇÕES AUXILIARES DO FIRESTORE ===============================
// ===================================================================

/**
 * Concede ou atualiza o acesso 'producer' para um usuário no Firestore.
 * @param {string} email O email do usuário.
 */
async function grantProducerAccess(email) {
    if (!email) {
        console.warn("[Firestore] Tentativa de conceder acesso sem um email.");
        return;
    }

    const docId = email.replace(/\./g, '_'); // Converte o email em um ID de documento válido
    const userRef = db.collection('artifacts').doc(APP_INSTANCE_ID).collection('users').doc(docId);
    const userData = {
        email: email,
        accessLevel: 'producer',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        await userRef.set(userData, { merge: true });
        console.log(`[Firestore] Acesso 'producer' concedido/atualizado para: ${email}`);
    } catch (error) {
        console.error(`[Firestore] ERRO ao conceder acesso para ${email}:`, error);
    }
}

// ===================================================================
// === INICIALIZAÇÃO DO SERVIDOR =====================================
// ===================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('================================================');
    console.log(`  Servidor da Infinit DAW rodando na porta ${PORT}`);
    console.log('================================================');
});
