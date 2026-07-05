
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
    const updates = [
        { id: '5c2099dd-fc10-4fdc-9dcc-72216decc17e', g: 2, a: 0, m: 10, nick: 'Guu', comment: 'Golaço!' },
        { id: '112b2bc1-eef6-4ec6-b5e8-90f243e3b271', g: 3, a: 0, m: 5, nick: 'Celsin' },
        { id: '6a4895b8-3c03-4f6d-923c-4785b869ca0b', g: 3, a: 0, m: 5, nick: 'WC/Werley' },
        { id: '1cd4d857-b544-407b-81b0-3540ec14c758', g: 1, a: 0, m: 2, nick: 'Jv' },
        { id: '188b8623-3ea7-4c4c-9b5a-43aad55d8198', g: 2, a: 0, m: 4, nick: 'luizhenrique' },
        { id: 'e54fa23d-158e-46f0-8b8a-25431bc43535', g: 2, a: 0, m: -20, nick: 'Mr (Parnaiba)', badge: 'mr_badge_rodada_0902', thought: 'Queria pênalti do meio de campo kkk' },
        { id: 'b9e0ce08-d2a5-40a9-ba0a-384f21f36992', g: 0, a: 1, m: -10, nick: 'Ptk', comment: 'Perdeu gol sem goleiro!' },
        { id: 'bf5b30dc-3630-44cf-87b5-50fba3be3822', g: 0, a: 3, m: 15, nick: 'L.C (Luciano)' },
        { id: 'cecb5794-259a-4334-86a9-621905820d04', g: 0, a: 0, m: -5, nick: 'Brow', comment: 'Ficou de 4 na quadra' }
    ];

    for (const u of updates) {
        const { data: p, error } = await supabase.from('players').select('*').eq('id', u.id).single();
        if (error) {
            console.error(`Error fetching ${u.nick}:`, error);
            continue;
        }

        let badges = typeof p.badges === 'string' ? JSON.parse(p.badges) : (p.badges || []);
        if (u.badge && !badges.includes(u.badge)) badges.push(u.badge);

        const updatePayload = {
            goals: (p.goals || 0) + u.g,
            assists: (p.assists || 0) + u.a,
            moral_score: Math.max(0, Math.min(200, (p.moral_score || 0) + u.m)),
            badges: JSON.stringify(badges)
        };

        if (u.thought) updatePayload.thought = u.thought;

        await supabase.from('players').update(updatePayload).eq('id', u.id);
        console.log(`Updated ${u.nick}`);
    }
}

run();
