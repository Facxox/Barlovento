'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  ReactNode,
} from 'react';

/**
 * Línea de carrito normal. Compatible con todos los productos actuales.
 *
 * NO usa `kind` para mantener compatibilidad retroactiva con items
 * guardados antes de la feature de contenedores. Para distinguirlas,
 * miramos si el item tiene `composition` populated.
 */
export type CartItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  qty: number;
  /**
   * Cuántos alfajores trae cada unidad del producto (1 = suelto,
   * 12 = caja de 12). Se multiplica por `qty` para calcular el envío.
   * Default 1 al hidratar carritos existentes que no tienen el campo.
   */
  unitsPerPack: number;
};

/**
 * Línea de carrito con personalización (contenedor). Tiene los mismos
 * campos base + una composición de productos hijos. Se guarda en
 * `localStorage` como un objeto aparte con id propio (las líneas
 * personalizadas NO se fusionan aunque sean del mismo contenedor).
 *
 * El `parentLineId` se usa como clave estable para identificar la
 * configuración (importante para la persistencia en Supabase cart_*
 * y para que dos customizaciones distintas coexistan).
 */
export type ContainerCartItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  qty: number;
  unitsPerPack: number;
  /** Marcamos presencia para distinguir de CartItem en runtime checks. */
  kind: 'container';
  parentLineId: string;
  composition: CartItemCompositionLine[];
  containerPriceTotal: number;
};

export type CartItemCompositionLine = {
  child_product_id: string;
  child_name: string;
  qty: number;
  unit_price: number;
  currency: string;
  child_image: string | null;
};

export type AnyCartItem = CartItem | ContainerCartItem;

/** Type guard runtime: ¿este item es un contenedor custom? */
export function isContainerItem(
  item: AnyCartItem
): item is ContainerCartItem {
  return (item as Partial<ContainerCartItem>).kind === 'container';
}

type CartState = { items: AnyCartItem[] };
type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'qty'>; qty?: number }
  | {
      type: 'addContainer';
      item: Omit<ContainerCartItem, 'qty'>;
      qty?: number;
    }
  | { type: 'remove'; id: string }
  | { type: 'qty'; id: string; qty: number }
  | { type: 'clear' }
  | { type: 'hydrate'; items: AnyCartItem[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      // Productos normales: se fusionan por id.
      // (Una línea de contenedor con `parentLineId` distinto nunca
      // coincide con este id porque producto normales no usan
      // ese prefijo.)
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, qty: i.qty + (action.qty ?? 1) } : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { ...action.item, qty: action.qty ?? 1 } as CartItem,
        ],
      };
    }
    case 'addContainer': {
      // Personalizaciones NUNCA se fusionan (cada configuración es única).
      return {
        items: [
          ...state.items,
          { ...action.item, qty: action.qty ?? 1 } as ContainerCartItem,
        ],
      };
    }
    case 'remove':
      return { items: state.items.filter((i) => i.id !== action.id) };
    case 'qty':
      return {
        items: state.items
          .map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i))
          .filter((i) => i.qty > 0),
      };
    case 'clear':
      return { items: [] };
    case 'hydrate':
      return { items: action.items };
    default:
      return state;
  }
}

type CartCtx = {
  items: AnyCartItem[];
  count: number;
  subtotal: number;
  /**
   * Total de alfajores en el carrito (Σ qty × unitsPerPack). Para
   * contenedores, `unitsPerPack` ya equivale al total de unidades
   * físicas (Σ children.qty) así que la fórmula sigue funcionando.
   */
  alfajores: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  addContainer: (item: Omit<ContainerCartItem, 'qty'>, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

/** Normaliza items antiguos al nuevo shape. Si trae `kind: 'container'`
 *  Y `composition`, lo deja; si no, lo marca como CartItem normal. */
function normalize(items: AnyCartItem[]): AnyCartItem[] {
  return items.map((it) => {
    const c = it as Partial<ContainerCartItem>;
    if (c.kind === 'container' && Array.isArray(c.composition)) {
      const physicalUnits =
        c.composition.reduce((acc, l) => acc + (l.qty ?? 0), 0) || 1;
      return {
        ...(it as ContainerCartItem),
        unitsPerPack:
          typeof c.unitsPerPack === 'number' && c.unitsPerPack > 0
            ? c.unitsPerPack
            : physicalUnits,
      } as ContainerCartItem;
    }
    const norm = it as CartItem;
    return {
      ...norm,
      unitsPerPack:
        typeof norm.unitsPerPack === 'number' && norm.unitsPerPack > 0
          ? norm.unitsPerPack
          : 1,
    } as CartItem;
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('barlovento.cart');
      if (raw) {
        const parsed = JSON.parse(raw) as AnyCartItem[];
        dispatch({ type: 'hydrate', items: normalize(parsed) });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('barlovento.cart', JSON.stringify(state.items));
    } catch {}
  }, [state.items, hydrated]);

  const subtotal = state.items.reduce((acc, i) => acc + i.price * i.qty, 0);
  const count = state.items.reduce((acc, i) => acc + i.qty, 0);
  const alfajores = state.items.reduce(
    (acc, i) => acc + i.qty * (i.unitsPerPack ?? 1),
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        count,
        subtotal,
        alfajores,
        add: (item, qty = 1) => {
          dispatch({ type: 'add', item, qty });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('barlovento:cart-added', {
                detail: {
                  id: item.id,
                  name: item.name,
                  image: item.image,
                },
              })
            );
          }
        },
        addContainer: (item, qty = 1) => {
          dispatch({ type: 'addContainer', item, qty });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('barlovento:cart-added', {
                detail: {
                  id: item.id,
                  name: item.name,
                  image: item.image,
                },
              })
            );
          }
        },
        remove: (id) => dispatch({ type: 'remove', id }),
        setQty: (id, qty) => dispatch({ type: 'qty', id, qty }),
        clear: () => dispatch({ type: 'clear' }),
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartCtx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
