import { getSiteContent } from '@/lib/queries';
import Contacto from './Contacto';

export default async function ContactoServer() {
  const { contacto, mayoristas } = await getSiteContent();
  return <Contacto contacto={contacto} mayoristas={mayoristas} />;
}
