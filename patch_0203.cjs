/**
 * PATCH: Corrigir stats duplicados da pelada 02/03.
 * O script original rodou 2x, gerando duplicação.
 * Definindo os valores CORRETOS (base anterior + 1x pelada 02/03).
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

// Corrected final values: original stats + ONE application of 02/03 match
const corrections = [
    // Tonoli: was G:6 A:6 M:151, match: +2g +2a +6m => G:8 A:8 M:157
    { id: 'd9344c3b-2728-4e0f-8bf3-fec27b73c516', goals: 8, assists: 8, moral_score: 157, name: 'Tonoli' },
    // JV: was G:7 A:0 M:113, match: +1g +1a +3m => G:8 A:1 M:116
    { id: '1cd4d857-b544-407b-81b0-3540ec14c758', goals: 8, assists: 1, moral_score: 116, name: 'JV' },
    // Cleitim: was G:2 A:2 M:93, match: +3g +0a +6m => G:5 A:2 M:99
    { id: 'e87ed5eb-af93-4a84-aab9-2cc0e6187da6', goals: 5, assists: 2, moral_score: 99, name: 'Cleitim' },
    // Micael/Ml: was G:6 A:1 M:109, match: +2g +0a +4m => G:8 A:1 M:113
    { id: '28465778-2f53-43c8-98ee-471506dbc3eb', goals: 8, assists: 1, moral_score: 113, name: 'Ml' },
    // Celsin: was G:8 A:2 M:128, match: +5g +4a +24m (5g*2 + 4a*1 + 1chapeu*10 - 1victim*10) => +10+4+10-10=14 => M:142, G:13 A:6
    { id: '112b2bc1-eef6-4ec6-b5e8-90f243e3b271', goals: 13, assists: 6, moral_score: 142, name: 'Celsin' },
    // Guu: was G:8 A:2 M:137, match: +1g +0a +2m => G:9 A:2 M:139
    { id: '5c2099dd-fc10-4fdc-9dcc-72216decc17e', goals: 9, assists: 2, moral_score: 139, name: 'Guu' },
    // Max: was G:2 A:0 M:90, match: +2g +0a +4m => G:4 A:0 M:94
    { id: '1bf31bdc-723d-4849-b9b2-5a6622b790df', goals: 4, assists: 0, moral_score: 94, name: 'Max' },
    // WC/Wesley: was G:8 A:2 M:138, match: +2g +0a +4m => G:10 A:2 M:142
    { id: '6a4895b8-3c03-4f6d-923c-4785b869ca0b', goals: 10, assists: 2, moral_score: 142, name: 'WC' },
    // Semente: was G:2 A:1 M:105, match: +3g +0a +6g_moral + 2caneta*10 - 1chapeu_victim*-10 = +6+20-10=+16 => M:121, G:5 A:1
    { id: 'cb431014-9794-4d58-a698-4815ab2d2749', goals: 5, assists: 1, moral_score: 121, name: 'Semente' },
    // Jota: was G:0 A:0 M:100, match: +1g +0a +2m => G:1 A:0 M:102
    { id: '21b47f15-8e6f-429d-a85c-61b1d73e8de7', goals: 1, assists: 0, moral_score: 102, name: 'Jota' },
    // PH/Bin: was G:2 A:3 M:102, match: +1g +0a -8m (1g*2 - 1caneta_victim*-10 = 2-10=-8) => G:3 A:3 M:94
    { id: '14330fae-4d33-470e-ab00-9bd9acf42564', goals: 3, assists: 3, moral_score: 94, name: 'PH/Bin' },
];

async function run() {
    console.log('=== PATCH: CORRIGINDO STATS DUPLICADOS ===\n');

    for (const c of corrections) {
        const { error } = await supabase
            .from('players')
            .update({ goals: c.goals, assists: c.assists, moral_score: c.moral_score })
            .eq('id', c.id);

        if (error) {
            console.error(`  ❌ ${c.name}:`, error.message);
        } else {
            console.log(`  ✅ ${c.name.padEnd(15)} → G:${c.goals} A:${c.assists} M:${c.moral_score}`);
        }
    }

    console.log('\n=== PATCH COMPLETO ===');
}

run().catch(console.error);
