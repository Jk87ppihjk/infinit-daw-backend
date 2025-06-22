// src/server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Mantido como estava no seu original
const admin = require('firebase-admin'); // Mantido como estava no seu original

// Certifique-se de que a sua variável de ambiente FIREBASE_CONFIG está definida
// e contém o JSON de configuração do Firebase.
// Ex: no Render.com, adicione FIREBASE_CONFIG com o conteúdo do seu serviceAccountKey.json
if (process.env.FIREBASE_CONFIG) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK inicializado com sucesso.');
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin SDK:', error);
    // Em produção, você pode querer encerrar o aplicativo se a inicialização do Firebase falhar
    // process.exit(1);
  }
} else {
  console.warn('Variável de ambiente FIREBASE_CONFIG não encontrada. Firebase Admin SDK não inicializado.');
}


// Importe o novo arquivo de rotas de IA
const aiRoutes = require('./routes/ai_routes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rota para lidar com a criação de sessões de checkout do Stripe
app.post('/create-checkout-session', async (req, res) => {
  const { priceId, userId, userName, userEmail } = req.body;

  try {
    // Busca informações do usuário no Firestore, se userId for fornecido
    let customerId;
    if (userId) {
      const userRef = admin.firestore().collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.stripeCustomerId) {
          customerId = userData.stripeCustomerId;
        }
      }
    }

    // Se não houver customerId, crie um novo cliente Stripe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: {
          firebaseUid: userId // Armazena o UID do Firebase para referência futura
        }
      });
      customerId = customer.id;

      // Salva o Stripe Customer ID no Firestore para futuras transações
      if (userId) {
        await admin.firestore().collection('users').doc(userId).set(
          { stripeCustomerId: customerId },
          { merge: true }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId, // Usa o customerId existente ou recém-criado
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://infinitdaw.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://infinitdaw.com/cancel',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    res.status(500).json({ error: error.message });
  }
});


// Rota para lidar com webhooks do Stripe
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Lide com o evento
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout Session Completed:', session);
      // Aqui você pode provisionar o acesso ao produto/serviço
      // ou atualizar o status da assinatura no seu banco de dados
      // Ex: Obter customer.id e o subscription.id e associar ao usuário
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (customerId && subscriptionId) {
        // Encontre o usuário no Firestore pelo stripeCustomerId
        const usersRef = admin.firestore().collection('users');
        const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await userDoc.ref.update({
            hasProAccess: true, // Ou o nome do seu campo de acesso premium
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'active',
            lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Usuário ${userDoc.id} atualizado com acesso Pro e assinatura Stripe.`);
        } else {
          console.warn(`Nenhum usuário encontrado com stripeCustomerId: ${customerId}`);
        }
      }
      break;
    case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object;
        console.log('Subscription Updated:', subscriptionUpdated.id, 'Status:', subscriptionUpdated.status);
        // Atualize o status da assinatura no seu banco de dados
        // Você pode ter diferentes status como 'active', 'past_due', 'canceled', etc.
        const updatedCustomerId = subscriptionUpdated.customer;
        const usersRefUpdated = admin.firestore().collection('users');
        const querySnapshotUpdated = await usersRefUpdated.where('stripeCustomerId', '==', updatedCustomerId).get();

        if (!querySnapshotUpdated.empty) {
            const userDoc = querySnapshotUpdated.docs[0];
            await userDoc.ref.update({
                subscriptionStatus: subscriptionUpdated.status,
                hasProAccess: subscriptionUpdated.status === 'active' || subscriptionUpdated.status === 'trialing'
            });
            console.log(`Status da assinatura do usuário ${userDoc.id} atualizado para ${subscriptionUpdated.status}.`);
        }
        break;
    case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object;
        console.log('Subscription Deleted:', subscriptionDeleted.id);
        // Remova o acesso ao produto/serviço quando a assinatura é cancelada
        const deletedCustomerId = subscriptionDeleted.customer;
        const usersRefDeleted = admin.firestore().collection('users');
        const querySnapshotDeleted = await usersRefDeleted.where('stripeCustomerId', '==', deletedCustomerId).get();

        if (!querySnapshotDeleted.empty) {
            const userDoc = querySnapshotDeleted.docs[0];
            await userDoc.ref.update({
                hasProAccess: false,
                subscriptionStatus: 'canceled',
                stripeSubscriptionId: admin.firestore.FieldValue.delete() // Remove o ID da assinatura se não for mais relevante
            });
            console.log(`Acesso Pro do usuário ${userDoc.id} removido devido ao cancelamento da assinatura.`);
        }
        break;
    // ... lidar com outros tipos de eventos conforme necessário
    default:
      console.log(`Evento Stripe não tratado: ${event.type}`);
  }

  res.json({ received: true });
});


// Sirva os arquivos estáticos da sua DAW (frontend)
// A pasta 'daww' deve estar na raiz do seu projeto infinit-daw-backend
// __dirname se refere a 'src', então '../daww' vai para a raiz do projeto e depois para 'daww'
app.use(express.static(path.join(__dirname, '../daww')));

// Rota principal para servir o index.html da sua DAW
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../daww/index.html'));
});

// Use as rotas de IA, prefixando-as com '/api/ai'
// Isso significa que a rota '/process-eq-ai' em ai_routes.js será acessível via /api/ai/process-eq-ai
app.use('/api/ai', aiRoutes);

// Início do servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
