// server.js - VERSÃO FINAL COM VERIFICAÇÃO DE WEBHOOK E FIREBASE FIRESTORE

// Importações necessárias
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe'); // Importa o SDK do Stripe
const admin = require('firebase-admin'); // Importa o SDK Admin do Firebase

// ===================================================================
// === CONFIGURAÇÃO DO FIREBASE ADMIN SDK ============================
// ===================================================================
// As credenciais para o Firebase Admin SDK são obtidas de uma variável de ambiente.
// VOCÊ PRECISARÁ CONFIGURAR 'FIREBASE_SERVICE_ACCOUNT_KEY' NO RENDER.COM
// com o conteúdo JSON do seu arquivo de chave de conta de serviço do Firebase.
// Esta é a forma SEGURA de fazer isso em produção.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
    process.exit(1); // Encerra o processo se a chave não estiver presente
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

const db = admin.firestore(); // Obtém uma instância do Firestore

// ===================================================================
// === CONFIGURAÇÃO DO STRIPE ========================================
// ===================================================================
// A chave secreta do webhook do Stripe deve ser configurada como uma variável de ambiente no Render.com
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeWebhookSecret) {
    console.error("ERRO: Variável de ambiente STRIPE_WEBHOOK_SECRET não configurada.");
    process.exit(1);
}

// Inicializa o Stripe (você pode usar sua chave secreta de API aqui, mas não é estritamente necessário para webhooks,
// que usam a chave secreta do webhook para verificação. No entanto, se você fosse fazer chamadas à API do Stripe
// como criar customers, então precisaria inicializar o Stripe com sua chave secreta de API:
// const stripe = require('stripe')('sua_chave_secreta_aqui');
// Por enquanto, apenas importamos a biblioteca 'stripe' para usar o método 'webhooks.constructEvent'.
// Para o propósito deste `server.js`, a chave secreta do webhook é suficiente para a segurança do webhook.
// Se você precisar fazer outras operações Stripe (criar clientes, etc.), inicialize o SDK do Stripe com sua chave de API secreta aqui.
// Ex: const stripeSdk = stripe('sk_test_sua_chave_secreta_aqui');
// Para este exemplo, apenas a importação de 'stripe' é suficiente para a verificação.

const app = express();
// O Render.com atribui uma porta dinâmica, então usamos process.env.PORT
const port = process.env.PORT || 3000;

app.use(cors()); // Permite requisições de diferentes origens

// ===================================================================
// === ROTA DO WEBHOOK DO STRIPE =====================================
// ===================================================================
// Usamos body-parser.raw para obter o corpo da requisição bruta, necessário para a verificação do Stripe.
// Esta rota deve vir ANTES de app.use(bodyParser.json());
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature']; // Assinatura do Stripe
    let event;

    try {
        // MUITO IMPORTANTE: Verificação da assinatura do webhook!
        // Isso garante que a requisição veio mesmo do Stripe e não foi adulterada.
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
        console.log('[Webhook] Evento Stripe recebido e assinado com sucesso.');
    } catch (err) {
        console.error(`ERRO: Falha na verificação da assinatura do webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lidando com o evento 'checkout.session.completed'
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.customer_details.email;

        if (userEmail) {
            console.log(`[Webhook] Pagamento bem-sucedido para o email: ${userEmail}`);
            await grantProducerAccess(userEmail); // Chama nossa função assíncrona para liberar o acesso no Firestore
        } else {
            console.warn('[Webhook] Evento checkout.session.completed sem email de cliente.');
        }
    }
    // Adicione outros eventos de webhook conforme necessário (ex: customer.subscription.updated, customer.subscription.deleted)
    // Exemplo para 'customer.subscription.updated':
    else if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const customerId = subscription.customer; // ID do cliente Stripe

        // Em um cenário real, você buscaria o email do usuário associado a este customerId no Firestore
        // Para simplificar, vamos assumir que você tem uma forma de mapear customerId para email ou que o email
        // já está no objeto subscription se for um checkout.session.completed anterior.
        // Ou você pode buscar o Customer do Stripe com stripeSdk.customers.retrieve(customerId)
        // Para este exemplo, vamos assumir que a informação necessária para o email está disponível ou pode ser recuperada.
        
        // Exemplo: se o email estiver no metadata da assinatura ou da sessão de checkout inicial
        const userEmail = subscription.metadata && subscription.metadata.userEmail ? subscription.metadata.userEmail : null;

        if (userEmail) {
            console.log(`[Webhook] Assinatura atualizada para o email: ${userEmail}. Status: ${subscription.status}`);
            if (subscription.status === 'active' || subscription.status === 'trialing') {
                await grantProducerAccess(userEmail);
            } else {
                await revokeProducerAccess(userEmail); // Implementar revokeProducerAccess
            }
        } else {
            console.warn(`[Webhook] Evento customer.subscription.updated sem email de cliente. Customer ID: ${customerId}`);
        }
    }
    // Exemplo para 'customer.subscription.deleted':
    else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userEmail = subscription.metadata && subscription.metadata.userEmail ? subscription.metadata.userEmail : null;
        
        if (userEmail) {
            console.log(`[Webhook] Assinatura DELETADA para o email: ${userEmail}.`);
            await revokeProducerAccess(userEmail); // Implementar revokeProducerAccess
        } else {
            console.warn(`[Webhook] Evento customer.subscription.deleted sem email de cliente. Customer ID: ${subscription.customer}`);
        }
    }
    // Exemplo para 'invoice.payment_succeeded':
    else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;
        const userEmail = invoice.customer_email; // O email pode estar diretamente na fatura
        if (userEmail) {
            console.log(`[Webhook] Pagamento de fatura bem-sucedido para o email: ${userEmail}.`);
            await grantProducerAccess(userEmail);
        } else {
            console.warn(`[Webhook] Evento invoice.payment_succeeded sem email de cliente. Invoice ID: ${invoice.id}`);
        }
    }
    // Adicione mais `else if` para outros tipos de evento que você precisa lidar.
    else {
        console.log(`[Webhook] Evento Stripe não processado: ${event.type}`);
    }
    
    // Responde ao Stripe para confirmar o recebimento do evento
    res.json({ received: true });
});


// O resto das requisições usará o bodyParser.json normal.
// Esta linha deve vir DEPOIS da rota do webhook com bodyParser.raw
app.use(bodyParser.json());

/**
 * ===================================================================
 * === FUNÇÕES DE MANIPULAÇÃO DE USUÁRIOS NO FIRESTORE ===============
 * ===================================================================
 */

/**
 * Concede ou atualiza o acesso 'producer' para um usuário no Firestore.
 * @param {string} email O email do usuário.
 */
async function grantProducerAccess(email) {
    if (!email) {
        console.warn("[Firestore] Tentativa de conceder acesso sem email.");
        return;
    }

    const userRef = db.collection('artifacts').doc(__app_id).collection('users').doc(email.replace(/\./g, '_')); // Usa __app_id e substitui '.' para o ID do documento
    const userData = {
        email: email,
        accessLevel: 'producer',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp() // Carimbo de data/hora do servidor
    };

    try {
        await userRef.set(userData, { merge: true }); // 'merge: true' atualiza ou cria o documento
        console.log(`[Firestore] Acesso 'producer' concedido/atualizado para o email: ${email}`);
    } catch (error) {
        console.error(`[Firestore] ERRO ao conceder acesso 'producer' para ${email}:`, error);
    }
}

/**
 * Revoga o acesso 'producer' de um usuário no Firestore, alterando para 'free'.
 * @param {string} email O email do usuário.
 */
async function revokeProducerAccess(email) {
    if (!email) {
        console.warn("[Firestore] Tentativa de revogar acesso sem email.");
        return;
    }

    const userRef = db.collection('artifacts').doc(__app_id).collection('users').doc(email.replace(/\./g, '_'));
    const userData = {
        accessLevel: 'free',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        await userRef.set(userData, { merge: true }); // Atualiza o documento, mantendo outros campos
        console.log(`[Firestore] Acesso do email: ${email} revogado para 'free'.`);
    } catch (error) {
        console.error(`[Firestore] ERRO ao revogar acesso para ${email}:`, error);
    }
}


// Endpoint para verificação de assinatura (agora usando Firestore)
app.post('/verificar-assinatura', async (req, res) => {
    const { userEmail } = req.body;
    console.log(`[Servidor] Recebida verificação para o email: ${userEmail}`);

    if (!userEmail) {
        return res.status(400).json({
            message: "Email do usuário não fornecido.",
            accessLevel: "free"
        });
    }

    try {
        // NOTA: Para IDs de documentos no Firestore, '.' não são recomendados.
        // É uma boa prática substituí-los por algo como '_', ou usar UIDs do Firebase Auth.
        // Aqui, estou substituindo '.' por '_' para compatibilidade.
        const userDoc = await db.collection('artifacts').doc(__app_id).collection('users').doc(userEmail.replace(/\./g, '_')).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.accessLevel === 'producer') {
                console.log(`[Servidor] Usuário ${userEmail} encontrado no Firestore. Status: ${userData.accessLevel}`);
                return res.json({
                    email: userEmail,
                    status: 'ativo',
                    accessLevel: userData.accessLevel
                });
            }
        }
        // Se não existir, ou se o accessLevel não for 'producer'
        console.log(`[Servidor] Usuário ${userEmail} não encontrado ou sem assinatura 'producer'. Concedendo acesso 'free'.`);
        res.json({
            email: userEmail,
            status: 'inativo',
            accessLevel: 'free'
        });

    } catch (error) {
        console.error(`[Servidor] ERRO ao verificar assinatura para ${userEmail} no Firestore:`, error);
        // Em caso de erro, por segurança, conceda acesso 'free' e registre o erro.
        res.status(500).json({
            message: "Erro interno do servidor ao verificar assinatura.",
            accessLevel: "free"
        });
    }
});


// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando na porta ${port}`);
    console.log(`  Rota de Webhook esperando em /stripe-webhook`);
    console.log(`================================================`);
});
