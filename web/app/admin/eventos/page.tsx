import { getServerSupabase } from '@/lib/supabase-server';
import EventosTable from '@/components/admin/EventosTable';
import eventsJson from '@/data/events.json';
import type { BarloventoEvent } from '@/lib/queries';

async function listAllEvents(): Promise<BarloventoEvent[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return eventsJson as BarloventoEvent[];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });
  if (error || !data) return [];
  return data as BarloventoEvent[];
}

export default async function AdminEventosPage() {
  const events = await listAllEvents();
  return <EventosTable events={events} />;
}