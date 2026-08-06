import { getGallery } from '@/lib/queries';
import Galeria from './Galeria';

export default async function GaleriaServer() {
  const items = await getGallery();
  if (items.length === 0) return null;
  return <Galeria items={items} />;
}
