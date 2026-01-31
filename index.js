const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const P = require('pino')
const fs = require('fs')

const OWNER = ['258871966285'] // teu número

const TABELA = `
📱 *PACOTES DISPONÍVEIS*
━━━━━━━━━━━━━━━━━━
250MB → 5MT
600MB → 10MT
850MB → 15MT
1GB → 17MT

Digite: *comprar 600mb*
`

const PAGAMENTO = `
💰 *FORMAS DE PAGAMENTO*
━━━━━━━━━━━━━━━━━━
MPesa: 855641710
e-Mola: 871966285

Envie o comprovativo.
`

const PACOTES = {
  '250mb': { preco: 5 },
  '600mb': { preco: 10 },
  '850mb': { preco: 15 },
  '1gb': { preco: 17 }
}

function registrarVenda(dados) {
  const file = './vendas.json'
  const vendas = JSON.parse(fs.readFileSync(file))
  vendas.push(dados)
  fs.writeFileSync(file, JSON.stringify(vendas, null, 2))
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    version
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        start()
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    const body = text.toLowerCase()

    // MENU
    if (body === 'menu' || body === 'oi') {
      await sock.sendMessage(from, {
        text: '📌 MENU\n• tabela\n• pagamento\n• comprar 600mb'
      })
    }

    // TABELA
    if (body === 'tabela') {
      await sock.sendMessage(from, { text: TABELA })
    }

    // PAGAMENTO
    if (body === 'pagamento') {
      await sock.sendMessage(from, { text: PAGAMENTO })
    }

    // COMPRAR
    if (body.startsWith('comprar')) {
      const pacote = body.replace('comprar', '').trim()
      if (!PACOTES[pacote]) {
        return sock.sendMessage(from, { text: '❌ Pacote inválido.' })
      }

      const venda = {
        cliente: sender,
        pacote,
        preco: PACOTES[pacote].preco,
        data: new Date().toLocaleString('pt-BR')
      }

      registrarVenda(venda)

      await sock.sendMessage(from, {
        text: `✅ Pedido registrado!\nPacote: ${pacote}\nValor: ${PACOTES[pacote].preco}MT\nEnvie o comprovativo.`
      })
    }
  })
}

start()