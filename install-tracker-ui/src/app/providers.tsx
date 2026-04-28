/**
 * Root providers — wraps the entire app with React Query + user context.
 *
 * HOW TO MODIFY:
 * - staleTime: 0 means every navigation refetches from DB. Change to e.g., 30000
 *   for 30-second caching if you want less DB load.
 * - selectedUser: the "active user" filter. "All" shows all installs.
 *   To add more global state (e.g., theme), add it to AppContextType.
 */

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, createContext, useContext } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,           // always refetch — DB is source of truth
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});

interface AppContextType {
  selectedUser: string;
  setSelectedUser: (user: string) => void;
}

const AppContext = createContext<AppContextType>({
  selectedUser: "All",
  setSelectedUser: () => {},
});

export function useAppContext() {
  return useContext(AppContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [selectedUser, setSelectedUser] = useState("All");

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ selectedUser, setSelectedUser }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}
