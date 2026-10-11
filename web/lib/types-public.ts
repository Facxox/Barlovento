// Re-export de tipos compartidos cliente/servidor.
// Mantiene un único punto de importación para los componentes.
export type { Product } from './queries';
export type {
  ContainerConfig,
  ContainerChild,
  CompositionLine,
  PriceMode,
  ContainerPricing,
  ContainerValidation,
  ProductRef,
} from './container';
export type { ProductImage } from './gallery';
