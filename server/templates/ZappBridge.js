/**
 * ZappBridge - Ponte de Integração para Catracas
 * ZapFitness (c) 2025
 * 
 * Este script deve rodar no computador da recepção da academia.
 * Ele ouve os comandos do servidor e aciona a catraca local.
 */

const { io } = require("socket.io-client");
const { exec } = require("child_process");
const axios = require("axios"); // Para catracas com API local (Control iD)

// CONFIGURAÇÕES (Injetadas pelo Painel ZapFitness)
const SERVER_URL = "https://zapp.fitness";
const GATE_TOKEN = "SEU_TOKEN_AQUI";
const TENANT_ID = "SEU_ID_DA_ACADEMIA";
const BRAND = "MARCA_DA_CATRACA"; // henry, topdata, controlid, etc

console.log(`
==========================================
   ZAPFITNESS - PONTE DE HARDWARE V2.0   
==========================================
🚀 Iniciando ZappBridge...
📦 Marca Configurada: ${BRAND.toUpperCase()}
`);

const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true
});

socket.on("connect", () => {
    console.log("✅ Conectado ao servidor ZapFitness");
    socket.emit("join_room", { room: TENANT_ID, token: GATE_TOKEN });
    console.log(`📡 Monitorando acessos para academia: ${TENANT_ID}`);
});

socket.on("gate:open", async (data) => {
    console.log(`🔓 LIBERAÇÃO RECEBIDA: ${data.memberName}`);
    console.log(`⏰ Horário: ${new Date(data.timestamp).toLocaleString()}`);

    try {
        await triggerHardware(BRAND, data);
        console.log("✨ Comando enviado para o hardware com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao acionar hardware:", err.message);
    }
});

socket.on("gate:denied", (data) => {
    console.log(`⛔ ACESSO NEGADO: ${data.memberName || 'Visitante'} - Motivo: ${data.reason}`);
    console.log(`⏰ Horário: ${new Date(data.timestamp || Date.now()).toLocaleString()}`);
});

socket.on("disconnect", () => {
    console.log("❌ Desconectado do servidor. Tentando reconectar...");
});

socket.on("connect_error", (error) => {
    console.error("⚠️ Erro de conexão:", error.message);
});

/**
 * LÓGICA DE DRIVERS PARA CADA MARCA
 */
async function triggerHardware(brand, data) {
    switch (brand.toLowerCase()) {
        case 'henry':
            // Driver Henry: Geralmente via executável de liberação (7comm)
            // Exemplo: C:\Henry\Liberar.exe (ajustar conforme manual do técnico local)
            exec("C:\\ZapFitness\\DRIVERS\\henry_open.exe", (err) => {
                if (err) throw new Error("Falha ao executar Driver Henry: " + err.message);
            });
            break;

        case 'topdata':
            // Driver Topdata: Via executável Inner
            exec("C:\\ZapFitness\\DRIVERS\\topdata_open.exe", (err) => {
                if (err) throw new Error("Falha ao executar Driver Topdata: " + err.message);
            });
            break;

        case 'controlid':
            // Control iD Local: Se estiver na mesma rede, podemos mandar um POST direto pro IP da catraca
            // O IP deve ser configurado ou ser o padrão da rede
            try {
                await axios.post('http://192.168.1.201/access_relay.fcgi', {
                    relay: 1,
                    timeout: 2000
                }, { timeout: 1000 });
            } catch (e) {
                console.log("⚠️ Tentando via executável secundário...");
                exec("C:\\ZapFitness\\DRIVERS\\controlid_local.exe");
            }
            break;

        case 'madis':
            exec("C:\\ZapFitness\\DRIVERS\\madis_open.exe");
            break;

        case 'generic':
        case 'usb_relay':
            // Módulo de Relé USB: Geralmente um simples comando Serial
            // Aqui você pode adicionar a biblioteca 'serialport' se for usar algo mais avançado
            console.log("🔌 Acionando Relé USB / Módulo Genérico...");
            exec("echo 1 > COM3"); // Exemplo simples de comando para porta serial no Windows
            break;

        default:
            console.log("ℹ️ Marca 'Genérica' selecionada. Apenas logando no sistema.");
            // Aqui no futuro podemos adicionar um logger em arquivo txt
            break;
    }
}
