import { create } from 'zustand';
import type { Order, Position, Portfolio } from '../types/orders';

interface OrderState {
  orders: Order[];
  positions: Position[];
  portfolio: Portfolio | null;
  
  setOrders: (orders: Order[]) => void;
  addOrUpdateOrder: (order: Order) => void;
  setPositions: (positions: Position[]) => void;
  setPortfolio: (portfolio: Portfolio) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  positions: [],
  portfolio: null,

  setOrders: (orders) => set({ orders }),
  addOrUpdateOrder: (order) => set((state) => {
    const existing = state.orders.findIndex(o => o.id === order.id);
    if (existing >= 0) {
      const newOrders = [...state.orders];
      newOrders[existing] = order;
      return { orders: newOrders };
    }
    return { orders: [order, ...state.orders] };
  }),
  setPositions: (positions) => set({ positions }),
  setPortfolio: (portfolio) => set({ portfolio }),
}));
