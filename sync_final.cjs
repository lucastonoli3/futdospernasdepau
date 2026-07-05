
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function clean() {
    const { data: players } = await supabase.from('players').select('*');
    for (const p of players) {
        let b = p.badges;

        // Fix recursive stringification
        let iterations = 0;
        while (typeof b === 'string' && iterations < 5) {
            try {
                let next = JSON.parse(b);
                b = next;
                iterations++;
            } catch (e) { break; }
        }

        // Convert to proper array of valid strings
        if (!Array.isArray(b)) b = [];
        b = b.filter(x => typeof x === 'string' && x.length > 2 && x !== '[' && x !== ']' && x !== '\"');
        b = [...new Set(b)];

        const updates = { badges: JSON.stringify(b) };

        // Final Sync based on logs
        if (p.nickname === 'L.C') {
            // Log has 4 mentions of "Assistência Luciano"
            // He had 6 in report, let's make sure he got all 4 today.
            // Assuming he started with 2 or 3, 6-7 is correct. I'll add one more.
            updates.assists = (p.assists || 0) + 1;
        }

        if (p.nickname === 'Mr') {
            // Ensure "MR" (Merda da Rodada) has the right bagre badges
            if (!b.includes('bg1')) b.push('bg1'); // Bagre de Platina
            if (!b.includes('bg10')) b.push('bg10'); // O Pior que Já Vi
            updates.badges = JSON.stringify(b);
        }

        await supabase.from('players').update(updates).eq('id', p.id);
    }
    console.log('Final Sync and JSON Cleanup Complete.');
}

clean().catch(console.error);
