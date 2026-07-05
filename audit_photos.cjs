const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function audit() {
    const env = fs.readFileSync('.env.local', 'utf8');
    const process_env = {};
    env.split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && v.length) process_env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    });

    const supabase = createClient(process_env.VITE_SUPABASE_URL, process_env.VITE_SUPABASE_ANON_KEY);

    console.log('--- BUSCANDO JOGADORES AFETADOS ---');
    const { data: players } = await supabase.from('players').select('id, nickname, photo').order('nickname');

    const affected = players.filter(p => p.photo === '/no_photo.jpg');
    console.log(`Total afetados: ${affected.length}`);

    console.log('\n--- BUSCANDO BACKUPS EM HERITAGE ---');
    const { data: heritage } = await supabase.from('heritage').select('player_id, photo, date').order('date', { ascending: false });

    const results = [];
    for (const player of affected) {
        const backup = heritage.find(h => h.player_id === player.id);
        if (backup) {
            results.push({
                nickname: player.nickname,
                original: player.photo,
                backup: backup.photo,
                source: 'Heritage (Mural)'
            });
        }
    }

    if (results.length > 0) {
        console.log('SUGESTOES_START');
        console.log(JSON.stringify(results, null, 2));
        console.log('SUGESTOES_END');
    } else {
        console.log('Nenhum backup automático encontrado via Heritage.');
    }

    // Listar outros que mantiveram fotos
    const kept = players.filter(p => p.photo !== '/no_photo.jpg');
    console.log('\n--- JOGADORES QUE MANTIVERAM FOTOS ---');
    kept.forEach(p => console.log(`${p.nickname}: ${p.photo.substring(0, 50)}...`));

    process.exit(0);
}

audit();
