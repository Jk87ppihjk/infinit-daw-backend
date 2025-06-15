// server.js - VERSÃO ATUALIZADA COM ROTA PARA WEBHOOK DO STRIPE

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(cors());
// IMPORTANTE: Para o webhook do Stripe, usamos bodyParser.raw para receber os dados puros.
// A rota específica do webhook usará um middleware diferente.
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), (req, res) => {
    // Em um app real, você primeiro verificaria a assinatura do webhook para garantir
    // que a requisição veio mesmo do Stripe. Ex: const sig = req.headers['stripe-signature'];
    
    let event;

    try {
        event = JSON.parse(req.body);
    } catch (err) {
        console.error('ERRO: Não foi possível parsear o corpo do webhook.');
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lidando com o evento 'checkout.session.completed'
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.customer_details.email;

        if (userEmail) {
            console.log(`[Webhook] Pagamento bem-sucedido para o email: ${userEmail}`);
            grantProducerAccess(userEmail); // Chama nossa função para liberar o acesso
        }
    }
    
    // Responde ao Stripe para confirmar o recebimento do evento
    res.json({received: true});
});


// O resto das requisições usará o bodyParser.json normal.
app.use(bodyParser.json());

/**
 * ===================================================================
 * === BANCO DE DADOS SIMULADO =======================================
 * ===================================================================
 */
const mockDatabase = [
    { 
        email: "usuario_pagante@email.com", 
        subscriptionStatus: "producer",
        expiresIn: "2025-12-31" 
    },
    // O banco começa vazio ou com usuários de teste. O webhook irá adicionar novos usuários.
];

// ===================================================================
// ===== NOVA FUNÇÃO PARA ATUALIZAR O STATUS DO USUÁRIO ============
// ===================================================================
function grantProducerAccess(email) {
    if (!email) return;

    // Procura se o usuário já existe no nosso banco de dados
    const userIndex = mockDatabase.findIndex(user => user.email === email);

    if (userIndex !== -1) {
        // Se o usuário já existe, apenas atualiza o status dele
        mockDatabase[userIndex].subscriptionStatus = 'producer';
        console.log(`[Servidor] Acesso do usuário existente ${email} atualizado para 'producer'.`);
    } else {
        // Se o usuário não existe, adiciona ele ao banco de dados como 'producer'
        mockDatabase.push({
            email: email,
            subscriptionStatus: 'producer',
            expiresIn: null // Pode-se adicionar a lógica de expiração depois
        });
        console.log(`[Servidor] Novo usuário ${email} adicionado com acesso 'producer'.`);
    }
    console.log('[Servidor] Estado atual do Banco de Dados:', mockDatabase);
}


// Endpoint principal para verificação de assinatura (sem alterações)
app.post('/verificar-assinatura', (req, res) => {
    const { userEmail } = req.body;
    console.log(`[Servidor] Recebida verificação para o email: ${userEmail}`);

    if (!userEmail) {
        return res.status(400).json({ 
            message: "Email do usuário não fornecido.",
            accessLevel: "free"
        });
    }

    const userRecord = mockDatabase.find(user => user.email === userEmail);

    if (userRecord && userRecord.subscriptionStatus === 'producer') {
        console.log(`[Servidor] Usuário ${userEmail} encontrado. Status: ${userRecord.subscriptionStatus}`);
        res.json({
            email: userRecord.email,
            status: 'ativo',
            accessLevel: userRecord.subscriptionStatus
        });
    } else {
        console.log(`[Servidor] Usuário ${userEmail} não encontrado ou sem assinatura ativa. Concedendo acesso 'free'.`);
        res.json({
            email: userEmail,
            status: 'inativo',
            accessLevel: 'free'
        });
    }
});


// Inicia o servidor
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`  Servidor da Infinit DAW rodando em http://localhost:${port}`);
    console.log(`  Rota de Webhook esperando em /stripe-webhook`);
    console.log(`================================================`);
});
