import { getSiteContent } from '@/lib/queries';
import Contacto from './Contacto';

export default async function ContactoServer() {
  const { contacto } = await getSiteContent();
  return <Contacto contacto={contacto} />;
}
