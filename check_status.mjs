import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mpbmssohpjwijkyhtucm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wYm1zc29ocGp3aWpreWh0dWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDg4MjEsImV4cCI6MjA5NzMyNDgyMX0.TP7OfhgKzLlAJSvdXirT-rcW6K-Qka2Cs7uo7P-FmgU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('nome, categoria, status')
    .eq('categoria', 'Vasos Cerâmicas')
    .limit(5);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(data);
}

checkProdutos();
