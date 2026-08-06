import { getGallery } from '@/lib/queries';
import Galeria from './Galeria';

export default async function GaleriaServer() {
  const items = await getGallery();
  return <Galeria items={items} />;
}
