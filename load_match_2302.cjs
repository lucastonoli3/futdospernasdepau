/**
 * Súmula via Chat — Pelada 23/02/2026
 * Carga em lote de eventos do WhatsApp para o Supabase.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

// ====== PLAYER MAP ======
const P = {
    BENE: '4449f392-2af3-40d2-871c-60685494a04a', // Dudu = Bené (Eduardo)
    CELSIN: '112b2bc1-eef6-4ec6-b5e8-90f243e3b271', // Celsin / Celso
    JV: '1cd4d857-b544-407b-81b0-3540ec14c758',
    GUU: '5c2099dd-fc10-4fdc-9dcc-72216decc17e',
    MICAEL: '28465778-2f53-43c8-98ee-471506dbc3eb', // Ml
    TONOLI: 'd9344c3b-2728-4e0f-8bf3-fec27b73c516',
    BROW: 'cecb5794-259a-4334-86a9-621905820d04',
    WC: '6a4895b8-3c03-4f6d-923c-4785b869ca0b',
    PTK: 'b9e0ce08-d2a5-40a9-ba0a-384f21f36992',
    MARKIN: 'e49d9b8e-3451-49da-b496-c2bb797799e7',
    CLEITIM: 'e87ed5eb-af93-4a84-aab9-2cc0e6187da6',
    MR: 'e54fa23d-158e-46f0-8b8a-25431bc43535', // Parnaíba = Mr (Marcos)
    SEMENTE: 'cb431014-9794-4d58-a698-4815ab2d2749',
    LH: '188b8623-3ea7-4c4c-9b5a-43aad55d8198', // luizhenrique / LH
    PH: '14330fae-4d33-470e-ab00-9bd9acf42564', // Bin = PH
};

// ====== GOAL EVENTS (parsed from WhatsApp chat) ======
const goals = [
    // { scorer, assist (optional), note (optional) }
    { scorer: P.BENE, assist: P.LH, note: 'Gol Dudu (assist LH)' },
    { scorer: P.CELSIN, assist: P.MICAEL, note: 'Gol Celsin (assist Micael)' },
    { scorer: P.CELSIN, note: 'Gol Celsin' },
    { scorer: P.JV, assist: P.CELSIN, note: 'Gol JV (assist Celso)' },
    { scorer: P.GUU, note: 'Gol Gu' },
    { scorer: P.CELSIN, note: 'Gol Celso' },
    { scorer: P.JV, note: 'Gol JV' },
    { scorer: P.MICAEL, note: 'Gol Micael' },
    { scorer: P.TONOLI, note: 'Gol Tonoli' },
    { scorer: P.BROW, assist: P.MARKIN, note: 'Gol Brow (assist Markin)' },
    { scorer: P.TONOLI, note: 'Gol Tonoli' },
    { scorer: P.WC, note: 'Gol WC' },
    { scorer: P.PTK, note: 'Gol Ptk' },
    { scorer: P.MARKIN, assist: P.PTK, note: 'Gol Markin (assist Ptk)' },
    { scorer: P.BENE, note: 'Gol Bené' },
    { scorer: P.PTK, note: 'Gol Ptk' },
    { scorer: P.JV, note: 'Gol JV' },
    { scorer: P.CLEITIM, note: 'Gol Cleiton' },
    { scorer: P.MR, assist: P.PH, note: 'Gol Parnaíba (assist Bin/PH)' },
    { scorer: P.SEMENTE, assist: P.PH, note: 'Gol Semente (assist Bin/PH)' },
    { scorer: P.SEMENTE, assist: P.PH, note: 'Gol Semente (assist Bim/PH)' },
    { scorer: P.GUU, note: 'Gol Gu' },
    { scorer: P.MR, note: 'Gol Parnaíba' },
    { scorer: P.MR, assist: P.SEMENTE, note: 'Gol Parnaíba (assist Semente)' },
    { scorer: P.TONOLI, note: 'Gol Tonoli (pênalti)' },
    { scorer: P.LH, note: 'Gol Luiz Henrique' },
    { scorer: P.LH, note: 'Gol Luiz Henrique' },
    { scorer: P.LH, note: 'Gol LH' },
];

// ====== HUMILIATION EVENTS ======
const humiliations = [
    { performer: P.CLEITIM, victim: P.PTK, type: 'CHAPEU', note: 'Chapéu Cleitim no Ptk' },
    { performer: P.TONOLI, victim: P.CLEITIM, type: 'CHAPEU', note: 'Chapéu do Tonoli no Cleiton' },
];

// ====== SHAME EVENTS (Furadas) ======
const shameEvents = [
    { player: P.PH, type: 'FURADA', note: 'Furada feia do Bin (PH)', moral: -5 },
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

    // Shame: negative moral
    for (const s of shameEvents) {
        init(s.player);
        stats[s.player].moral += s.moral;
    }

    return stats;
}

// ====== NICKNAME MAP (for logging) ======
const nickMap = {};
for (const [k, v] of Object.entries(P)) nickMap[v] = k;

async function run() {
    console.log('=== SÚMULA VIA CHAT — PELADA 23/02/2026 ===\n');

    const stats = tallyStats();

    // Print summary
    console.log('📊 RESUMO DE STATS:');
    for (const [id, s] of Object.entries(stats)) {
        console.log(`  ${nickMap[id].padEnd(10)} → Gols: +${s.goals}, Assists: +${s.assists}, Moral: ${s.moral >= 0 ? '+' : ''}${s.moral}`);
    }
    console.log(`\n  Total de gols: ${goals.length}`);
    console.log(`  Total de assistências: ${goals.filter(g => g.assist).length}`);
    console.log(`  Humilhações: ${humiliations.length}`);
    console.log(`  Furadas: ${shameEvents.length}\n`);

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
        text += ` [Súmula 23/02]`;
        muralMessages.push({ player_id: g.scorer, text });
    }

    for (const h of humiliations) {
        const { data: perf } = await supabase.from('players').select('nickname').eq('id', h.performer).single();
        const { data: vict } = await supabase.from('players').select('nickname').eq('id', h.victim).single();
        muralMessages.push({
            player_id: h.performer,
            text: `💀 CRIME! ${perf?.nickname} aplicou um CHAPÉU humilhante em ${vict?.nickname}. [Súmula 23/02]`
        });
    }

    for (const s of shameEvents) {
        const { data: p } = await supabase.from('players').select('nickname').eq('id', s.player).single();
        muralMessages.push({
            player_id: s.player,
            text: `🤡 VEXAME! ${p?.nickname} entregou uma FURADA FEIA pro bueiro. [Súmula 23/02]`
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
    console.log(`Total de eventos processados: ${goals.length + humiliations.length + shameEvents.length}`);
}

run().catch(err => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});
