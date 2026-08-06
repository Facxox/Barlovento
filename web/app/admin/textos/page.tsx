import TextosEditor from '@/components/admin/TextosEditor';
import { getSiteContent } from '@/lib/queries';

export default async function AdminTextosPage() {
  const content = await getSiteContent();
  return <TextosEditor initial={content} />;
}