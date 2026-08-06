'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  ReactNode,
} from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  qty: number;
};

type CartState = { items: CartItem[] };
type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'qty'>; qty?: number }
  | { type: 'remove'; id: string }
  | { type: 'qty'; id: string; qty: number }
  | { type: 'clear' }
  | { type: 'hydrate'; items: CartItem[] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, qty: i.qty + (action.qty ?? 1) } : i
          ),
        };
      }
      return { items: [...state.items, { ...action.item, qty: action.qty ?? 1 }] };
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
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Persistir en localStorage — solo el carrito del visitante, no contenido del sitio.
  // El contenido del sitio (productos, galería, textos) sale de Supabase en Fase 2.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('barlovento.cart');
      if (raw) {
        const parsed: CartItem[] = JSON.parse(raw);
        dispatch({ type: 'hydrate', items: parsed });
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

  const subtotal = state.items.reduce(
    (acc, i) => acc + i.price * i.qty,
    0
  );
  const count = state.items.reduce((acc, i) => acc + i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        count,
        subtotal,
        add: (item, qty = 1) => {
          dispatch({ type: 'add', item, qty });
          setIsOpen(true);
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