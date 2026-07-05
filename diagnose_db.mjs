
import { createClient } from '@supabase/supabase-client';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.error("Env vars not found");
    process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const supabase = createClient(url, key);

async function debug() {
    console.log("Checking Sessions...");
    const { data: sessions, error: sErr } = await supabase.from('sessions').select('id, status');
    console.log('Sessions:', sessions || sErr);

    console.log("Checking Finances...");
    const { data: finances, error: fErr } = await supabase.from('finances').select('id, total_balance');
    console.log('Finances:', finances || fErr);

    console.log("Checking Players...");
    const { data: players, error: pErr } = await supabase.from('players').select('id, nickname').limit(5);
    console.log('Players Sample:', players || pErr);
}
debug();
