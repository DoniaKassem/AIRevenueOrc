import { useEffect, useState } from 'react';
import { Command, X } from 'lucide-react';
import Modal from './Modal';

interface Shortcut {
  keys: string[];
  description: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  onNavigate?: (view: string) => void;
}

export default function KeyboardShortcuts({ onNavigate }: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowHelp(true);
        }
      }

      if (e.key === 'Escape') {
        setShowHelp(false);
      }

      if (!onNavigate) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            onNavigate('');
            window.location.hash = '';
            break;
          case 'p':
            e.preventDefault();
            onNavigate('prospects');
            window.location.hash = '#prospects';
            break;
          case 'c':
            e.preventDefault();
            onNavigate('cadences');
            window.location.hash = '#cadences';
            break;
          case 'l':
            e.preventDefault();
            onNavigate('pipeline');
            window.location.hash = '#pipeline';
            break;
          case 'a':
            e.preventDefault();
            onNavigate('analytics');
            window.location.hash = '#analytics';
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onNavigate]);

  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'Open global search' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
    { keys: ['Esc'], description: 'Close modals/dialogs' },
    { keys: ['⌘', 'Shift', 'D'], description: 'Go to Dashboard' },
    { keys: ['⌘', 'Shift', 'P'], description: 'Go to Prospects' },
    { keys: ['⌘', 'Shift', 'C'], description: 'Go to Cadences' },
    { keys: ['⌘', 'Shift', 'L'], description: 'Go to Pipeline' },
    { keys: ['⌘', 'Shift', 'A'], description: 'Go to Analytics' },
  ];

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 right-6 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-full shadow-lg transition z-40"
        title="Keyboard shortcuts"
      >
        <Command className="w-5 h-5" />
      </button>

      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Keyboard Shortcuts"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Use these keyboard shortcuts to navigate faster
          </p>

          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
              >
                <span className="text-sm text-slate-700">{shortcut.description}</span>
                <div className="flex items-center space-x-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono shadow-sm"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Note: On Windows/Linux, use Ctrl instead of ⌘
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
