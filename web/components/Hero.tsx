import { getSiteContent } from '@/lib/queries';
import HeroAnimated from './HeroAnimated';

export default async function Hero() {
  const { hero: h } = await getSiteContent();
  return <HeroAnimated hero={h} />;
}
