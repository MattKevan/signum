import { create, StateCreator } from 'zustand';

// --- Helper for screen size ---
const isDesktopView = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

// --- Type Definitions for the store structure ---

// Defines the shape of the data in the sidebar slice
interface SidebarState {
  isLeftOpen: boolean;
  isRightOpen: boolean;
  isLeftAvailable: boolean;
  isRightAvailable: boolean;
}

// Defines the actions available in the sidebar slice
interface SidebarActions {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftAvailable: (available: boolean) => void;
  setRightAvailable: (available: boolean) => void;
}

// Defines the shape of the data in the screen slice
interface ScreenState {
  isDesktop: boolean;
}

// Defines the actions available in the screen slice
interface ScreenActions {
    initializeScreenSize: () => void;
}

// The full store shape, combining state and actions
type UIState = {
    sidebar: SidebarState & SidebarActions;
    screen: ScreenState & ScreenActions;
}

// --- Store Slice Implementations ---

// Creates the sidebar slice of the store
const createSidebarSlice: StateCreator<UIState, [], [], { sidebar: SidebarState & SidebarActions }> = (set, get) => ({
  sidebar: {
    isLeftOpen: isDesktopView(),
    isRightOpen: isDesktopView(),
    isLeftAvailable: false,
    isRightAvailable: false,
    toggleLeftSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isLeftOpen: !state.sidebar.isLeftOpen, 
            // On mobile, opening one sidebar closes the other
            isRightOpen: !get().screen.isDesktop && !state.sidebar.isLeftOpen ? false : state.sidebar.isRightOpen 
        }
    })),
    toggleRightSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isRightOpen: !state.sidebar.isRightOpen, 
            isLeftOpen: !get().screen.isDesktop && !state.sidebar.isRightOpen ? false : state.sidebar.isLeftOpen 
        }
    })),
    setLeftAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isLeftAvailable: available }})),
    setRightAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isRightAvailable: available }})),
  }
});

// Creates the screen slice of the store
const createScreenSlice: StateCreator<UIState, [], [], { screen: ScreenState & ScreenActions }> = (set, get) => ({
    screen: {
        isDesktop: isDesktopView(),
        initializeScreenSize: () => {
          if (typeof window === 'undefined') return;

          const handleResize = () => {
            const desktop = isDesktopView();
            // Only update state if the view mode has actually changed
            if (desktop !== get().screen.isDesktop) {
              set({ 
                  screen: { ...get().screen, isDesktop: desktop }, 
                  // When the breakpoint is crossed, reset sidebars to default for that size
                  sidebar: { ...get().sidebar, isLeftOpen: desktop, isRightOpen: desktop }
                });
            }
          };
          window.addEventListener('resize', handleResize);
          handleResize(); // Set initial state on mount
        },
    }
});


// Combine the slices to create the final store
export const useUIStore = create<UIState>()((...a) => ({
    ...createSidebarSlice(...a),
    ...createScreenSlice(...a),
}));