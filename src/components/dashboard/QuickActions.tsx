import React from "react";

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={action.onClick}
          className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:border-neutral-700 transition-colors duration-150"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
