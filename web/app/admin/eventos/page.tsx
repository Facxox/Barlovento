import { getEvents } from '@/lib/queries';
import EventosTable from '@/components/admin/EventosTable';

export default async function AdminEventosPage() {
  // getEvents() ya incluye las imágenes agrupadas; lo usamos
  // también en admin para tener el mismo shape que la landing.
  const events = await getEvents();
  return <EventosTable events={events} />;
}
