
const { createClient } = require('@supabase/supabase-client');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking Supabase Connection...");

    const { data: players, error: pError } = await supabase.from('players').select('count');
    console.log("Players count:", players ? players[0] : "NULL", pError || "");

    const { data: session, error: sError } = await supabase.from('sessions').select('*').eq('id', 1).single();
    console.log("Session 1:", session ? "FOUND" : "NOT FOUND", sError || "");

    const { data: finances, error: fError } = await supabase.from('finances').select('*').eq('id', 1).single();
    console.log("Finances 1:", finances ? "FOUND" : "NOT FOUND", fError || "");

    if (finances) {
        console.log("Finances data:", JSON.stringify(finances, null, 2));
    }
}

check();
