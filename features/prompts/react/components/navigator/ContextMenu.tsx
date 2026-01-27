/**
 * Context menu component
 */
import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
    action: string;
    id: string;
    icon: string;
    label: string;
}

interface ContextMenuProps {
    items: ContextMenuItem[];
    position: { x: number; y: number };
    onAction: (action: string, id: string) => void;
    onClose: () => void;
}

export function ContextMenu({ items, position, onAction, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        }

        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <ul
            ref={menuRef}
            className="nemo-context-menu"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                display: 'block'
            }}
        >
            {items.map((item) => (
                <li
                    key={`${item.action}-${item.id}`}
                    onClick={() => {
                        onAction(item.action, item.id);
                        onClose();
                    }}
                >
                    <i className={`fa-solid ${item.icon}`} />
                    <span>{item.label}</span>
                </li>
            ))}
        </ul>
    );
}
