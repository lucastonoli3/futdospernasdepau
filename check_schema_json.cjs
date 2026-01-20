
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtdolegbbcquqiflkiww.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZG9sZWdiYmNxdXFpZmxraXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzEzNzIsImV4cCI6MjA4MzgwNzM3Mn0.48v5gwy8tsLM5vbcUGH-kRTKYo8s5hnj9I7fUDh1LrM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.log(JSON.stringify({ error: error.message }));
    } else {
        console.log(JSON.stringify({ columns: Object.keys(data), data }));
    }
}

checkSchema();
