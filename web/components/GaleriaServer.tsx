import { getGallery, getGalleryCategories } from '@/lib/queries';
import Galeria from './Galeria';

export default async function GaleriaServer() {
  const [items, categories] = await Promise.all([
    getGallery(),
    getGalleryCategories(),
  ]);
  if (items.length === 0) return null;
  return <Galeria items={items} categories={categories} />;
}
