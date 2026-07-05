/**
 * Súmula via Chat — Pelada 02/03/2026
 * Carga em lote de eventos do WhatsApp para o Supabase.
 * 
 * NOTA: "Wesley" mapeado como WC (Werley). Se for outro jogador, corrigir P.WESLEY.
 *       "Bin" = PH (como na súmula anterior).
 *       "Celsin" / "Celso" = mesmo jogador (Celsin).
 *       "Cleitin" / "Cleiton" = mesmo jogador (Cleitim).
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

// ====== PLAYER MAP ======
const P = {
    TONOLI: 'd9344c3b-2728-4e0f-8bf3-fec27b73c516',
    JV: '1cd4d857-b544-407b-81b0-3540ec14c758',
    CLEITIM: 'e87ed5eb-af93-4a84-aab9-2cc0e6187da6',  // Cleitin / Cleiton
    MICAEL: '28465778-2f53-43c8-98ee-471506dbc3eb',  // Ml
    CELSIN: '112b2bc1-eef6-4ec6-b5e8-90f243e3b271',  // Celsin / Celso
    GUU: '5c2099dd-fc10-4fdc-9dcc-72216decc17e',  // Gu
    MAX: '1bf31bdc-723d-4849-b9b2-5a6622b790df',
    WESLEY: '6a4895b8-3c03-4f6d-923c-4785b869ca0b',  // Wesley = WC (Werley)
    SEMENTE: 'cb431014-9794-4d58-a698-4815ab2d2749',
    WC: '6a4895b8-3c03-4f6d-923c-4785b869ca0b',
    JOTA: '21b47f15-8e6f-429d-a85c-61b1d73e8de7',  // Jota goleiro
    BIN: '14330fae-4d33-470e-ab00-9bd9acf42564',  // Bin = PH
};

// ====== GOAL EVENTS (parsed from WhatsApp chat 02/03) ======
const goals = [
    // [20:25] Gol Tonoli
    { scorer: P.TONOLI, note: 'Gol Tonoli' },
    // [20:36] Gol JV assistência Tonoli
    { scorer: P.JV, assist: P.TONOLI, note: 'Gol JV (assist Tonoli)' },
    // [20:36] Cleitin gol
    { scorer: P.CLEITIM, note: 'Gol Cleitin' },
    // [20:37] Assistência JV gol Micael
    { scorer: P.MICAEL, assist: P.JV, note: 'Gol Micael (assist JV)' },
    // [20:50] Assistência celsin Gol Gu
    { scorer: P.GUU, assist: P.CELSIN, note: 'Gol Gu (assist Celsin)' },
    // [20:51] Gol celsin
    { scorer: P.CELSIN, note: 'Gol Celsin' },
    // [20:52] Ass celsin gol Max
    { scorer: P.MAX, assist: P.CELSIN, note: 'Gol Max (assist Celsin)' },
    // [20:53] Gol Wesley
    { scorer: P.WESLEY, note: 'Gol Wesley' },
    // [20:57] Gol celsin
    { scorer: P.CELSIN, note: 'Gol Celsin' },
    // [20:57] Gol tonoli
    { scorer: P.TONOLI, note: 'Gol Tonoli' },
    // [21:03] Gol celsin
    { scorer: P.CELSIN, note: 'Gol Celsin' },
    // [21:04] Caneta semente no bin gol semente
    { scorer: P.SEMENTE, note: 'Gol Semente (caneta no Bin + gol)' },
    // [21:05] Assistência celsin gol wc
    { scorer: P.WC, assist: P.CELSIN, note: 'Gol WC (assist Celsin)' },
    // [21:29] Gol semente
    { scorer: P.SEMENTE, note: 'Gol Semente' },
    // [21:29] Gol semente
    { scorer: P.SEMENTE, note: 'Gol Semente' },
    // [21:29] Gol do goleiro jota
    { scorer: P.JOTA, note: 'Gol do goleiro Jota' },
    // [21:29] Golaço no ângulo celsin
    { scorer: P.CELSIN, note: 'Golaço Celsin (ângulo)' },
    // [21:29] Gol celsin
    { scorer: P.CELSIN, note: 'Gol Celsin' },
    // [21:29] Gol bin
    { scorer: P.BIN, note: 'Gol Bin (PH)' },
    // [21:29] Gol Cleiton
    { scorer: P.CLEITIM, note: 'Gol Cleiton' },
    // [21:50] Gol cleitin, assistência tonoli
    { scorer: P.CLEITIM, assist: P.TONOLI, note: 'Gol Cleitin (assist Tonoli)' },
    // [21:50] Gol max, assistência celsin
    { scorer: P.MAX, assist: P.CELSIN, note: 'Gol Max (assist Celsin)' },
    // [21:50] Gol micael
    { scorer: P.MICAEL, note: 'Gol Micael' },
];

// ====== HUMILIATION EVENTS ======
const humiliations = [
    // [20:49] Chapéu do celso no semente
    { performer: P.CELSIN, victim: P.SEMENTE, type: 'CHAPEU', note: 'Chapéu do Celso no Semente' },
    // [21:04] Caneta semente no bin
    { performer: P.SEMENTE, victim: P.BIN, type: 'CANETA', note: 'Caneta Semente no Bin' },
    // [21:29] Caneta semente no celsin
    { performer: P.SEMENTE, victim: P.CELSIN, type: 'CANETA', note: 'Caneta Semente no Celsin' },
];

// ====== TALLY STATS ======
function tallyStats() {
    const stats = {};
    const init = (id) => {
        if (!stats[id]) stats[id] = { goals: 0, assists: 0, moral: 0 };
    };

    // Goals: +1 goal, +2 moral per goal
    for (const g of goals) {
        init(g.scorer);
        stats[g.scorer].goals++;
        stats[g.scorer].moral += 2;

        if (g.assist) {
            init(g.assist);
            stats[g.assist].assists++;
            stats[g.assist].moral += 1;
        }
    }

    // Humiliations: performer +10, victim -10
    for (const h of humiliations) {
        init(h.performer);
        init(h.victim);
        stats[h.performer].moral += 10;
        stats[h.victim].moral -= 10;
    }

    return stats;
}

// ====== NICKNAME MAP (for logging) ======
const nickMap = {};
for (const [k, v] of Object.entries(P)) nickMap[v] = k;

async function run() {
    console.log('=== SÚMULA VIA CHAT — PELADA 02/03/2026 ===\n');

    const stats = tallyStats();

    // Print summary
    console.log('📊 RESUMO DE STATS:');
    for (const [id, s] of Object.entries(stats)) {
        console.log(`  ${nickMap[id].padEnd(10)} → Gols: +${s.goals}, Assists: +${s.assists}, Moral: ${s.moral >= 0 ? '+' : ''}${s.moral}`);
    }
    console.log(`\n  Total de gols: ${goals.length}`);
    console.log(`  Total de assistências: ${goals.filter(g => g.assist).length}`);
    console.log(`  Humilhações: ${humiliations.length}\n`);

    // ====== 1. UPDATE PLAYER STATS ======
    console.log('⚡ ATUALIZANDO STATS DOS JOGADORES...\n');
    for (const [id, s] of Object.entries(stats)) {
        const { data: player, error } = await supabase
            .from('players')
            .select('goals, assists, moral_score, nickname')
            .eq('id', id)
            .single();

        if (error || !player) {
            console.error(`  ❌ Erro ao buscar ${nickMap[id]} (${id}):`, error?.message || 'Not found');
            continue;
        }

        const newGoals = (player.goals || 0) + s.goals;
        const newAssists = (player.assists || 0) + s.assists;
        const newMoral = Math.max(0, Math.min(200, (player.moral_score || 0) + s.moral));

        const { error: updateError } = await supabase
            .from('players')
            .update({ goals: newGoals, assists: newAssists, moral_score: newMoral })
            .eq('id', id);

        if (updateError) {
            console.error(`  ❌ Erro ao atualizar ${player.nickname}:`, updateError.message);
        } else {
            console.log(`  ✅ ${player.nickname.padEnd(15)} Goals: ${player.goals}→${newGoals}, Assists: ${player.assists}→${newAssists}, Moral: ${player.moral_score}→${newMoral}`);
        }
    }

    // ====== 2. REGISTER HUMILIATIONS ======
    console.log('\n💀 REGISTRANDO HUMILHAÇÕES...\n');
    for (const h of humiliations) {
        const { data: perf } = await supabase.from('players').select('nickname').eq('id', h.performer).single();
        const { data: vict } = await supabase.from('players').select('nickname').eq('id', h.victim).single();

        const { error } = await supabase.from('humiliations').insert([{
            performer_id: h.performer,
            performerNickname: perf?.nickname || nickMap[h.performer],
            victim_id: h.victim,
            victimNickname: vict?.nickname || nickMap[h.victim],
            type: h.type,
            description: `${perf?.nickname} deu um ${h.type} no ${vict?.nickname}!`,
            status: 'confirmed'
        }]);

        if (error) {
            console.error(`  ❌ Humilhação falhou:`, error.message);
        } else {
            console.log(`  ✅ ${h.note}`);
        }
    }

    // ====== 3. INSERT RESENHA MESSAGES (Mural do Legado) ======
    console.log('\n📜 POSTANDO NO MURAL DO LEGADO...\n');

    const muralMessages = [];

    for (const g of goals) {
        const { data: scorer } = await supabase.from('players').select('nickname').eq('id', g.scorer).single();
        let text = `⚽ GOL! ${scorer?.nickname || '???'} mandou pro fundo da rede!`;
        if (g.assist) {
            const { data: asst } = await supabase.from('players').select('nickname').eq('id', g.assist).single();
            text += ` (Garçom: ${asst?.nickname || '???'})`;
        }
        text += ` [Súmula 02/03]`;
        muralMessages.push({ player_id: g.scorer, text });
    }

    for (const h of humiliations) {
        const { data: perf } = await supabase.from('players').select('nickname').eq('id', h.performer).single();
        const { data: vict } = await supabase.from('players').select('nickname').eq('id', h.victim).single();
        muralMessages.push({
            player_id: h.performer,
            text: `💀 CRIME! ${perf?.nickname} aplicou um ${h.type} humilhante em ${vict?.nickname}. [Súmula 02/03]`
        });
    }

    // Batch insert all mural messages
    const { error: muralError } = await supabase.from('resenha_messages').insert(muralMessages);
    if (muralError) {
        console.error(`  ❌ Erro no mural:`, muralError.message);
    } else {
        console.log(`  ✅ ${muralMessages.length} mensagens postadas no mural.`);
    }

    console.log('\n=== CARGA FINALIZADA COM SUCESSO! ===');
    console.log(`Total de jogadores atualizados: ${Object.keys(stats).length}`);
    console.log(`Total de eventos processados: ${goals.length + humiliations.length}`);
}

run().catch(err => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});
