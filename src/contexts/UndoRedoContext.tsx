import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Action {
  type: string;
  data: any;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  description: string;
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  addAction: (action: Action) => void;
  clear: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<Action[]>([]);
  const [redoStack, setRedoStack] = useState<Action[]>([]);

  const addAction = useCallback((action: Action) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    try {
      await action.undo();
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, action]);
    } catch (error) {
      console.error('Undo failed:', error);
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    try {
      await action.redo();
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, action]);
    } catch (error) {
      console.error('Redo failed:', error);
    }
  }, [redoStack]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undo,
        redo,
        addAction,
        clear,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within UndoRedoProvider');
  }
  return context;
}
