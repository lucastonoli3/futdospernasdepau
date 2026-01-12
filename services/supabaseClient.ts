
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Lógica de Negócio: Detector de Pelada de Churrasco
 * @returns boolean - true se for a última segunda-feira do mês corrente.
 */
export const isLastMondayOfMonth = () => {
    const today = new Date();
    if (today.getDay() !== 1) return false; // Se não for segunda, já era.

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Se a próxima segunda já for outro mês, significa que HOJE é a última segunda.
    return nextWeek.getMonth() !== today.getMonth();
};

/**
 * Formatação de Data da Resenha com Estética Noir
 */
export const getResenhaDate = () => {
    const now = new Date();
    return now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', ' •');
};
