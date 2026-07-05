
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://dtdolegbbcquqiflkiww.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZG9sZWdiYmNxdXFpZmxraXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzEzNzIsImV4cCI6MjA4MzgwNzM3Mn0.48v5gwy8tsLM5vbcUGH-kRTKYo8s5hnj9I7fUDh1LrM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// IDs dos jogadores
const JV_ID = '1cd4d857-b544-407b-81b0-3540ec14c758';
const SEMENTE_ID = 'cb431014-9794-4d58-a698-4815ab2d2749';
const JOTA_GOLEIRO_ID = '21b47f15-8e6f-429d-a85c-61b1d73e8de7';
const PH22_ID = '4d0f3fc1-de52-49ae-928d-c19331fd0436';

async function run() {
    const lines = [];
    const log = (msg) => { lines.push(msg); console.log(msg); };

    // Buscar todos os jogadores para referência
    const { data: allPlayers } = await supabase.from('players').select('id, nickname').order('nickname');

    // Buscar lista atual
    const { data: session } = await supabase.from('sessions').select('players_present').eq('id', 1).single();
    let list = [...(session?.players_present || [])];

    log('=== LISTA ANTES ===');
    list.forEach((id, i) => {
        const p = allPlayers.find(pl => pl.id === id);
        log(`  ${(i + 1).toString().padStart(2, '0')}. ${p ? p.nickname : 'DESCONHECIDO'}`);
    });

    // SWAP 1: JV entra no lugar do Semente (pos 7 = index 6), Semente vai pro final (suplente)
    const sementeIndex = list.indexOf(SEMENTE_ID);
    const jvIndex = list.indexOf(JV_ID);

    if (sementeIndex !== -1 && jvIndex !== -1) {
        // JV vai para onde o Semente está, Semente vai para onde o JV está (suplente)
        list[sementeIndex] = JV_ID;
        list[jvIndex] = SEMENTE_ID;
        log('\n✅ SWAP 1: JV agora é TITULAR (pos ' + (sementeIndex + 1) + '), Semente agora é SUPLENTE (pos ' + (jvIndex + 1) + ')');
    } else {
        log('\n❌ SWAP 1 FALHOU: Semente idx=' + sementeIndex + ', JV idx=' + jvIndex);
    }

    // SWAP 2: JOTA GOLEIRO entra no lugar do PH 22
    const ph22Index = list.indexOf(PH22_ID);

    if (ph22Index !== -1) {
        // Verificar se Jota já está na lista
        const jotaIndex = list.indexOf(JOTA_GOLEIRO_ID);
        if (jotaIndex !== -1) {
            // Jota já está na lista, fazer swap
            list[ph22Index] = JOTA_GOLEIRO_ID;
            list[jotaIndex] = PH22_ID;
            log('✅ SWAP 2: Jota goleiro agora é TITULAR (pos ' + (ph22Index + 1) + '), PH 22 saiu');
        } else {
            // Jota NÃO está na lista, substituir PH22 por Jota
            list[ph22Index] = JOTA_GOLEIRO_ID;
            // PH22 sai da lista completamente e vai pro final como suplente
            list.push(PH22_ID);
            log('✅ SWAP 2: Jota goleiro entrou na TITULAR (pos ' + (ph22Index + 1) + '), PH 22 foi pro final da lista (suplente, pos ' + list.length + ')');
        }
    } else {
        log('❌ SWAP 2 FALHOU: PH 22 não encontrado na lista');
    }

    log('\n=== LISTA DEPOIS ===');
    list.forEach((id, i) => {
        const p = allPlayers.find(pl => pl.id === id);
        const marker = i < 15 ? '⚽' : '🪑';
        log(`  ${marker} ${(i + 1).toString().padStart(2, '0')}. ${p ? p.nickname : 'DESCONHECIDO'}`);
    });

    // Atualizar no Supabase
    const { error } = await supabase.from('sessions').update({ players_present: list }).eq('id', 1);

    if (error) {
        log('\n❌ ERRO AO SALVAR: ' + JSON.stringify(error));
    } else {
        log('\n🔥 LISTA ATUALIZADA COM SUCESSO NO SUPABASE!');
    }

    fs.writeFileSync('swap_output.txt', lines.join('\n'), 'utf-8');
}

run();
