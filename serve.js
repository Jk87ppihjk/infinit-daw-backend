// server.js - VERSÃO FINAL E COMPLETA (COM IA, FIREBASE E STRIPE)

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const createAiRoutes = require('./routes/ai_routes.js');

// ===================================================================
// === CONFIGURAÇÃO DAS VARIÁVEIS DE AMBIENTE =======================
// ===================================================================
// ATENÇÃO: Configure estas variáveis no seu ambiente de hospedagem (Render, etc.)
// NUNCA deixe chaves secretas diretamente no código.

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY; // Em formato Base64
const geminiApiKey = process.env.GEMINI_API_KEY;

// ===================================================================
// === INICIALIZAÇÃO DOS SERVIÇOS ====================================
// ===================================================================

// --- Inicialização do Stripe ---
// A inicialização do Stripe precisa da chave secreta.
if (!stripeSecretKey) {
    console.error('[Stripe] ERRO: A variável de ambiente STRIPE_SECRET_KEY não foi definida.');
}
const stripe = require('stripe')(stripeSecretKey);


// --- Inicialização do Firebase Admin SDK ---
let db;
try {
    if (!firebaseServiceAccountKey) throw new Error("Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
    const serviceAccount = JSON.parse(Buffer.from(firebaseServiceAccountKey, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('[Firebase] Firebase Admin SDK inicializado com sucesso.');
} catch (error) {
    console.error('[Firebase] ERRO ao inicializar o Firebase Admin SDK:', error.message);
}

// --- Inicialização do Google Generative AI (Gemini) ---
let genAI;
try {
    if (!geminiApiKey) throw new Error("A variável de ambiente GEMINI_API_KEY é necessária para a IA.");
    genAI = new GoogleGenerativeAI(geminiApiKey);
    console.log('[AI] Google Generative AI SDK inicializado com sucesso.');
} catch(error) {
    console.error('[AI] ERRO ao inicializar o Google Generative AI SDK:', error.message);
}


// ===================================================================
// === CONFIGURAÇÃO DO SERVIDOR EXPRESS ==============================
// ===================================================================

const app = express();
app.use(cors());

// --- Webhook do Stripe ---
// Esta rota PRECISA vir ANTES do 'express.json()' porque o Stripe requer o corpo da requisição "raw" (sem parse).
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  if (!stripeWebhookSecret) {
      console.error('[Stripe] Webhook secret não configurado.');
      return response.status(400).send('Webhook secret não configurado.');
  }

  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, stripeWebhookSecret);
  } catch (err) {
    console.error(`[Stripe] Webhook Error: ${err.message}`);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Lida com o evento de checkout bem-sucedido
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    
    if (customerEmail && db) {
      const docId = customerEmail.replace(/\./g, '_');
      try {
        await db.collection('users').doc(docId).set({
          email: customerEmail,
          accessLevel: 'producer',
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          status: 'ativo'
        }, { merge: true });
        console.log(`[Stripe] Assinatura ativada para ${customerEmail}.`);
      } catch (error) {
        console.error("[Firebase] Erro ao atualizar usuário após pagamento:", error);
      }
    }
  } else {
    console.log(`[Stripe] Evento não tratado: ${event.type}`);
  }

  response.send();
});


// Middleware para fazer o parse de JSON para TODAS as outras rotas
app.use(express.json());

// --- Rotas de IA ---
const aiRouter = createAiRoutes(genAI);
app.use('/api', aiRouter);


// --- Rota para Verificar Licença ---
app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    if (!userEmail) {
        return res.status(400).json({ message: "Email do usuário não fornecido.", accessLevel: "free" });
    }
    if (!db) {
        return res.status(500).json({ message: "Serviço de banco de dados não disponível.", accessLevel: "free" });
    }

    try {
        const docId = userEmail.replace(/\./g, '_');
        const userDoc = await db.collection('users').doc(docId).get();

        if (userDoc.exists && userDoc.data().accessLevel === 'producer') {
            return res.json({ email: userEmail, status: 'ativo', accessLevel: 'producer' });
        }
        
        res.json({ email: userEmail, status: 'inativo', accessLevel: 'free' });

    } catch (error) {
        console.error(`[Servidor] ERRO ao verificar assinatura para ${userEmail}:`, error);
        res.status(500).json({ message: "Erro interno do servidor.", accessLevel: "free" });
    }
});


// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${PORT}`);
    console.log(`================================================`);
});
